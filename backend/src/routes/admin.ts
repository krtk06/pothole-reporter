import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requireAdmin, requireStateAdmin } from "../middleware/rbac";
import { validate } from "../middleware/validate";
import { adminLimiter } from "../middleware/rateLimiter";
import prisma from "../config/database";
import logger from "../config/logger";
import { generatePresignedDownloadUrl } from "../services/s3Service";
import { checkAndGenerateTender, dispatchTenderForMandal, generateTendersForScope, hasOpenTender } from "../services/tenderService";
import { ensureRoadIssueForReport } from "../services/roadIssueRegistry";
import {
  getTenderSyncConfig,
  performTenderSync,
  pushBlockToTenderWebsite,
  updateTenderSyncConfig,
} from "../services/tenderSyncService";
import { AuthenticatedRequest } from "../types";
import { buildBlockId, resolveDistrictForMandal } from "../services/geoService";

const router = Router();

router.use(authenticate, requireAdmin, adminLimiter);

const statusFilterSchema = z.object({
  status: z.enum(["pending", "verified", "rejected", "fixed"]).optional(),
});

function scopePrefix(req: AuthenticatedRequest): string | null {
  const scope = req.user?.admin_scope;
  const state = req.user?.admin_state;
  const district = req.user?.admin_district;
  const mandal = req.user?.admin_mandal;

  if (!scope || !state) {
    logger.warn({ adminId: req.user?.userId, admin_scope: scope }, "Admin jurisdiction unresolved; failing closed");
    return null;
  }

  if (scope === "mandal") {
    if (!district || !mandal) return null;
    return buildBlockId(state, district, mandal);
  }
  if (scope === "district") {
    if (!district) return null;
    return buildBlockId(state, district, null);
  }
  return buildBlockId(state, null, null);
}

function scopeCondition(
  prefix: string | null,
  column: string,
  parameterIndex: number,
  includeNull = false,
) {
  if (!prefix) return { clause: "1 = 0", params: [] as string[] };
  const nullClause = includeNull ? ` OR ${column} IS NULL` : "";
  return {
    clause: `(${column} = $${parameterIndex} OR ${column} LIKE $${parameterIndex + 1}${nullClause})`,
    params: [prefix, `${prefix}/%`],
  };
}

function prismaScopeWhere(req: AuthenticatedRequest) {
  const prefix = scopePrefix(req);
  if (!prefix) return { block_id: { in: [] as string[] } };
  return {
    OR: [{ block_id: prefix }, { block_id: { startsWith: `${prefix}/` } }],
  };
}

function jurisdictionOf(req: AuthenticatedRequest) {
  const scope = req.user!.admin_scope!;
  const district = req.user!.admin_district || null;
  const mandal = req.user!.admin_mandal || null;
  return {
    state: req.user!.admin_state || null,
    district,
    mandal,
    locality: mandal,
    level: scope,
    admin_scope: scope,
    canDispatchTender: scope === "mandal" || scope === "state",
    roleTitle:
      scope === "mandal"
        ? `Mandal Operations Officer (${mandal})`
        : scope === "district"
          ? `District Supervisory Officer (${district})`
          : "State Super Administrator",
  };
}

router.get("/jurisdiction", async (req: AuthenticatedRequest, res: Response) => {
  res.json(jurisdictionOf(req));
});

router.get("/reports", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = statusFilterSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Invalid status filter" });

    const conditions: string[] = [];
    const params: any[] = [];
    let index = 1;

    if (parsed.data.status) {
      conditions.push(`p.status = $${index}::text::"ReportStatus"`);
      params.push(parsed.data.status);
      index++;
    }

    const scope = scopeCondition(scopePrefix(req), "p.block_id", index, req.user?.admin_scope === "state");
    conditions.push(scope.clause);
    params.push(...scope.params);

    const reports: any[] = await prisma.$queryRawUnsafe(
      `SELECT p.id, u.name AS reporter_name, u.phone AS reporter_phone,
              p.image_s3_key, ST_X(p.location::geometry) AS longitude,
              ST_Y(p.location::geometry) AS latitude, p.status, p.block_id,
              p.address_notes, p.created_at
       FROM potholes p
       JOIN users u ON u.id = p.reporter_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY p.created_at DESC
       LIMIT 2000`,
      ...params,
    );

    const enriched = await Promise.all(
      reports.map(async (report) => ({
        ...report,
        longitude: Number(report.longitude),
        latitude: Number(report.latitude),
        image_url: await generatePresignedDownloadUrl(report.image_s3_key).catch(() => null),
      })),
    );

    res.json({ reports: enriched, jurisdiction: jurisdictionOf(req) });
  } catch (err) {
    logger.error({ err }, "Admin reports error");
    return res.status(500).json({ error: "Failed to fetch reports" });
  }
});

const updateReportSchema = z.object({
  status: z.enum(["pending", "verified", "rejected", "fixed"]),
});
const uuidParam = z.string().uuid();

router.patch("/reports/:id", validate(updateReportSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) return res.status(400).json({ error: "Invalid report ID" });
    const id = idResult.data;
    const { status } = req.body;

    const scope = scopeCondition(scopePrefix(req), "block_id", 3, req.user?.admin_scope === "state");
    const updated: any[] = await prisma.$queryRawUnsafe(
      `UPDATE potholes
       SET status = $1::text::"ReportStatus"
       WHERE id = $2::uuid AND ${scope.clause}
       RETURNING id, status, block_id`,
      status,
      id,
      ...scope.params,
    );
    if (updated.length === 0) return res.status(404).json({ error: "Report not found" });

    let roadIssueId: string | null = null;
    let tenderGenerated = false;
    const blockId = updated[0].block_id as string | null;

    if (status === "verified") {
      // AI may have been unavailable, so manual verification must create or
      // attach the physical map marker.
      try {
        const issue = await ensureRoadIssueForReport(id);
        roadIssueId = issue.issueId;
      } catch (err) {
        logger.error({ err, reportId: id }, "Failed to create road issue for verified report");
      }

      if (blockId) {
        try {
          tenderGenerated = await checkAndGenerateTender(blockId);
          // Push new evidence even when an open tender already exists.
          if (tenderGenerated || await hasOpenTender(blockId)) {
            await pushBlockToTenderWebsite(blockId, `admin:${req.user!.userId}`).catch(() => undefined);
          }
        } catch (err) {
          logger.error({ err, reportId: id, blockId }, "Tender generation failed after verification");
        }
      }
    }

    res.json({
      report: updated[0],
      road_issue_id: roadIssueId,
      tender_generated: tenderGenerated,
    });
  } catch (err) {
    logger.error({ err }, "Update report error");
    return res.status(500).json({ error: "Failed to update report" });
  }
});

router.get("/map-clusters", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pointScope = scopeCondition(scopePrefix(req), "p.block_id", 1, req.user?.admin_scope === "state");
    const densityScope = scopeCondition(scopePrefix(req), "block_id", 1, req.user?.admin_scope === "state");

    const clusters: any[] = await prisma.$queryRawUnsafe(
      `SELECT p.id, ST_X(p.location::geometry) AS longitude,
              ST_Y(p.location::geometry) AS latitude, p.status, p.block_id
       FROM potholes p
       WHERE ${pointScope.clause}`,
      ...pointScope.params,
    );

    const features = clusters.map((cluster) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [Number(cluster.longitude), Number(cluster.latitude)] },
      properties: { id: cluster.id, status: cluster.status, block_id: cluster.block_id },
    }));

    const density: any[] = await prisma.$queryRawUnsafe(
      `SELECT block_id, COUNT(*)::bigint AS count,
              AVG(ST_X(location::geometry)) AS avg_longitude,
              AVG(ST_Y(location::geometry)) AS avg_latitude
       FROM potholes
       WHERE block_id IS NOT NULL AND ${densityScope.clause}
       GROUP BY block_id`,
      ...densityScope.params,
    );

    res.json({
      potholes: { type: "FeatureCollection", features },
      blockDensity: density.map((row) => ({
        block_id: row.block_id,
        count: Number(row.count),
        avg_longitude: Number(row.avg_longitude),
        avg_latitude: Number(row.avg_latitude),
      })),
    });
  } catch (err) {
    logger.error({ err }, "Map clusters error");
    return res.status(500).json({ error: "Failed to fetch map data" });
  }
});

function serializeTender(tender: any) {
  return { ...tender, estimated_cost: Number(tender.estimated_cost) };
}

router.get("/tenders", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenders = await prisma.tender.findMany({
      where: prismaScopeWhere(req),
      orderBy: { generated_at: "desc" },
    });
    res.json({ tenders: tenders.map(serializeTender) });
  } catch (err) {
    logger.error({ err }, "Tenders error");
    return res.status(500).json({ error: "Failed to fetch tenders" });
  }
});

const updateTenderSchema = z.object({
  status: z.enum(["open", "assigned", "completed", "rejected"]),
});

router.patch("/tenders/:id", validate(updateTenderSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) return res.status(400).json({ error: "Invalid tender ID" });
    const result = await prisma.tender.updateMany({
      where: { id: idResult.data, ...prismaScopeWhere(req) },
      data: { status: req.body.status },
    });
    if (result.count === 0) return res.status(404).json({ error: "Tender not found" });
    const tender = await prisma.tender.findUnique({ where: { id: idResult.data } });
    res.json({ tender: tender ? serializeTender(tender) : null });
  } catch (err) {
    logger.error({ err }, "Update tender error");
    return res.status(500).json({ error: "Failed to update tender" });
  }
});

function withdrawUrlFromTarget(targetUrl: string): string {
  try {
    const parsed = new URL(targetUrl);
    const basePath = parsed.pathname.replace(/\/api\/sync\/?$/i, "");
    return `${parsed.origin}${basePath}/api/tenders`;
  } catch {
    return targetUrl;
  }
}

const generateTendersSchema = z.object({
  force: z.boolean().optional(),
});

router.post("/tenders/generate", validate(generateTendersSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const prefix = scopePrefix(req);
    if (!prefix) return res.status(400).json({ error: "Admin jurisdiction is not configured" });

    const generated = await generateTendersForScope(prefix, req.body.force === true);
    let pushFailures = 0;
    for (const item of generated) {
      const result = await pushBlockToTenderWebsite(item.block_id, `generate:admin:${req.user!.userId}`).catch(() => ({ success: false }));
      if (!result.success) pushFailures += 1;
    }

    const message = generated.length === 0
      ? "No new tenders were generated. All eligible blocks already have an open tender, or there are no verified potholes in your jurisdiction."
      : `Generated ${generated.length} tender(s) for ${prefix}.${pushFailures ? ` ${pushFailures} tender push(es) will be retried by the scheduled sync.` : ""}`;

    logger.info({ adminId: req.user!.userId, prefix, generated: generated.length, pushFailures }, "Manual tender generation completed");
    res.json({
      success: true,
      generated,
      generated_count: generated.length,
      push_failures: pushFailures,
      message,
    });
  } catch (err: any) {
    logger.error({ err }, "Manual tender generation error");
    return res.status(500).json({ error: err.message || "Failed to generate tenders" });
  }
});

router.post("/tenders/:id/withdraw", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) return res.status(400).json({ error: "Invalid tender ID" });

    const tender = await prisma.tender.findFirst({
      where: { id: idResult.data, ...prismaScopeWhere(req) },
    });
    if (!tender) return res.status(404).json({ error: "Tender not found" });
    if (tender.status !== "open") {
      return res.status(409).json({ error: `Only open tenders can be withdrawn (current: ${tender.status})` });
    }

    const updated = await prisma.tender.updateMany({
      where: { id: tender.id, status: "open", ...prismaScopeWhere(req) },
      data: { status: "rejected" },
    });
    if (updated.count === 0) return res.status(409).json({ error: "Tender is no longer open" });

    const { settings } = await getTenderSyncConfig();
    let dispatched = false;
    let withdrawError: string | null = null;

    if (!settings.target_url || !settings.api_key) {
      withdrawError = "Tender website URL or API key not configured; next scheduled sync will reconcile";
    } else {
      try {
        const response = await fetch(withdrawUrlFromTarget(settings.target_url), {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": settings.api_key,
            Authorization: `Bearer ${settings.api_key}`,
          },
          body: JSON.stringify({
            tender_id: tender.id,
            block_id: tender.block_id,
            triggered_by: `admin:${req.user?.userId || "admin"}`,
          }),
          signal: AbortSignal.timeout(15_000),
          redirect: "error",
        });
        dispatched = response.ok;
        if (!response.ok) withdrawError = `Tender website returned ${response.status}; next sync will reconcile`;
      } catch (err: any) {
        withdrawError = `Failed to reach tender website: ${err.message}; next sync will reconcile`;
      }
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO tender_sync_logs (potholes_count, tenders_count, status, error_message, triggered_by)
       VALUES (0, 1, $1, $2, $3)`,
      dispatched ? "success" : "failed",
      withdrawError,
      `withdraw:admin:${req.user?.userId || "admin"}`,
    ).catch(() => undefined);

    const fresh = await prisma.tender.findUnique({ where: { id: tender.id } });
    res.json({
      success: true,
      tender: fresh ? serializeTender(fresh) : null,
      withdraw_dispatched: dispatched,
    });
  } catch (err) {
    logger.error({ err }, "Withdraw tender error");
    return res.status(500).json({ error: "Failed to withdraw tender" });
  }
});

router.post("/tenders/dispatch", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = req.user!.admin_scope!;
    if (scope === "district") {
      return res.status(403).json({ error: "District officers are supervisory only; mandal officers dispatch tenders." });
    }

    const body = z.object({
      mandal: z.string().trim().min(1).max(160).optional(),
      district: z.string().trim().min(1).max(120).optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Invalid dispatch payload" });

    const mandal = scope === "mandal" ? req.user!.admin_mandal : body.data.mandal;
    let district: string | null | undefined = scope === "mandal" ? req.user!.admin_district : body.data.district;
    if (!mandal) return res.status(400).json({ error: "A mandal is required" });
    if (!req.user!.admin_state) return res.status(400).json({ error: "Admin state is not configured" });
    if (scope === "state" && !district) {
      district = await resolveDistrictForMandal(req.user!.admin_state, mandal);
    }
    if (!district) return res.status(400).json({ error: "A district is required for state-level dispatch" });

    const tender = await dispatchTenderForMandal({
      state: req.user!.admin_state,
      district,
      mandal,
      initiatedBy: req.user!.userId,
    });
    await pushBlockToTenderWebsite(tender.block_id, `dispatch:admin:${req.user!.userId}`).catch(() => undefined);

    res.json({
      success: true,
      message: `Tender batch dispatched for ${tender.block_id}`,
      tender,
      potholes_count: tender.pothole_count,
      tenders_count: 1,
      dispatched_by: jurisdictionOf(req).roleTitle,
    });
  } catch (err: any) {
    logger.error({ err }, "Tender dispatch error");
    return res.status(400).json({ error: err.message || "Failed to dispatch tender" });
  }
});

router.get("/hierarchy-summary", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = scopeCondition(scopePrefix(req), "block_id", 1);
    const summaries: any[] = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(block_id, 'Unassigned') AS block_id, status, COUNT(*)::bigint AS count
       FROM potholes
       WHERE ${scope.clause}
       GROUP BY block_id, status
       ORDER BY block_id ASC`,
      ...scope.params,
    );
    res.json({
      jurisdiction: jurisdictionOf(req),
      summaries: summaries.map((row) => ({ ...row, count: Number(row.count) })),
    });
  } catch (err) {
    logger.error({ err }, "Hierarchy summary error");
    return res.status(500).json({ error: "Failed to fetch hierarchy summary" });
  }
});

const updateSyncConfigSchema = z.object({
  target_url: z.string().url().optional(),
  api_key: z.string().min(6).optional(),
  sync_interval_days: z.number().int().min(15).max(30).optional(),
  is_enabled: z.boolean().optional(),
});

router.get("/tender-sync", requireStateAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(await getTenderSyncConfig());
  } catch (err) {
    logger.error({ err }, "Fetch tender sync config error");
    res.status(500).json({ error: "Failed to fetch tender sync configuration" });
  }
});

router.put("/tender-sync", requireStateAdmin, validate(updateSyncConfigSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await updateTenderSyncConfig(req.body);
    logger.info({ adminId: req.user?.userId }, "Tender sync settings updated");
    res.json({ settings });
  } catch (err: any) {
    logger.error({ err }, "Update tender sync config error");
    res.status(400).json({ error: err.message || "Failed to update tender sync configuration" });
  }
});

router.post("/tender-sync/trigger", requireStateAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await performTenderSync(`admin:${req.user?.userId || "admin"}`);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Trigger tender sync error");
    res.status(500).json({ error: "Failed to perform tender sync" });
  }
});

export default router;
