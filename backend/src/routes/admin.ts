import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/rbac";
import { validate } from "../middleware/validate";
import prisma from "../config/database";
import logger from "../config/logger";
import { generatePresignedDownloadUrl } from "../services/s3Service";
import { AuthenticatedRequest } from "../types";

const router = Router();

router.use(authenticate, requireAdmin);

const statusFilterSchema = z.object({
  status: z.enum(["pending", "verified", "rejected", "fixed"]).optional(),
});

/** Build scope prefix string for tender filtering.
 * Returns null when the admin's jurisdiction cannot be resolved — callers must
 * fail closed (no data) in that case. */
function getScopePrefix(req: AuthenticatedRequest): string | null {
  const scope = req.user?.admin_scope;
  const state = req.user?.admin_state;
  const district = req.user?.admin_district;
  const mandal = req.user?.admin_mandal;

  if (!scope || !state) {
    logger.warn(
      { adminId: req.user?.userId, admin_scope: scope },
      "Admin jurisdiction unresolved — failing closed (no data)"
    );
    return null;
  }

  const statePrefix = state.toLowerCase();

  if (scope === "mandal") {
    if (!district || !mandal) {
      logger.warn({ adminId: req.user?.userId }, "Mandal admin missing district/mandal — failing closed");
      return null;
    }
    return `${statePrefix}/${district.toLowerCase()}/${mandal.toLowerCase()}`;
  } else if (scope === "district") {
    if (!district) {
      logger.warn({ adminId: req.user?.userId }, "District admin missing district — failing closed");
      return null;
    }
    return `${statePrefix}/${district.toLowerCase()}`;
  }
  return statePrefix;
}

function getScopeCondition(scopePrefix: string | null, column: string, parameterIndex: number) {
  // Fail closed: an unresolved jurisdiction matches nothing
  if (!scopePrefix) return { clause: "1 = 0", params: [] as string[] };
  return {
    clause: `(${column} = $${parameterIndex} OR ${column} LIKE $${parameterIndex + 1})`,
    params: [scopePrefix, `${scopePrefix}/%`],
  };
}

/** Fail-closed scope condition derived straight from the request. */
function getScopeConditionForRequest(req: AuthenticatedRequest, column: string, parameterIndex: number) {
  return getScopeCondition(getScopePrefix(req), column, parameterIndex);
}

/** Prisma where-clause limiting tenders to the admin's jurisdiction; empty set when unresolved. */
function getPrismaScopeWhere(req: AuthenticatedRequest): any {
  const scopePrefix = getScopePrefix(req);
  if (!scopePrefix) return { block_id: { in: [] } };
  return {
    OR: [
      { block_id: scopePrefix },
      { block_id: { startsWith: `${scopePrefix}/` } },
    ],
  };
}

function isStateScopeAdmin(req: AuthenticatedRequest): boolean {
  return req.user?.admin_scope === "state";
}

router.get("/reports", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = statusFilterSchema.safeParse(req.query);
    const status = parsed.success ? parsed.data.status : undefined;

    let conditions: string[] = [];
    let params: any[] = [];
    let paramIdx = 1;

    if (status) {
      conditions.push(`p.status = $${paramIdx}::text::"ReportStatus"`);
      params.push(status);
      paramIdx++;
    }

    // Always apply scope (fails closed when the jurisdiction is unresolved)
    const scopeCondition = getScopeConditionForRequest(req, "p.block_id", paramIdx);
    conditions.push(scopeCondition.clause);
    params.push(...scopeCondition.params);
    paramIdx += 2;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT
        p.id,
        u.name as reporter_name,
        u.phone as reporter_phone,
        p.image_s3_key,
        ST_X(p.location::geometry) as longitude,
        ST_Y(p.location::geometry) as latitude,
        p.status,
        p.block_id,
        p.created_at
      FROM potholes p
      JOIN users u ON u.id = p.reporter_id
      ${whereClause}
      ORDER BY p.created_at DESC
    `;

    const reports: any[] = await prisma.$queryRawUnsafe(query, ...params);

    const enriched = await Promise.all(
      reports.map(async (r: any) => ({
        ...r,
        longitude: Number(r.longitude),
        latitude: Number(r.latitude),
        image_url: await generatePresignedDownloadUrl(r.image_s3_key).catch(() => null),
      }))
    );

    res.json({ reports: enriched });
  } catch (err: any) {
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
    const { status } = req.body;
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      res.status(400).json({ error: "Invalid report ID" });
      return;
    }
    const id = idResult.data;
    const scopeCondition = getScopeConditionForRequest(req, "block_id", 3);

    const result: any[] = await prisma.$queryRawUnsafe(`
      UPDATE potholes
      SET status = $1::text::"ReportStatus"
      WHERE id = $2::uuid${scopeCondition.clause ? ` AND ${scopeCondition.clause}` : ""}
      RETURNING id, status
    `, status, id, ...scopeCondition.params);

    if (result.length === 0) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    logger.info({ reportId: id, newStatus: status, adminId: req.user!.userId }, "Report status updated");
    res.json({ report: result[0] });
  } catch (err: any) {
    logger.error({ err }, "Update report error");
    return res.status(500).json({ error: "Failed to update report" });
  }
});

router.get("/map-clusters", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scopeCondition = getScopeConditionForRequest(req, "p.block_id", 1);
    const densityScopeCondition = getScopeConditionForRequest(req, "block_id", 1);

    let conditions = [`p.status = 'verified'`];
    let params: any[] = [];

    // Always apply scope (fails closed when the jurisdiction is unresolved)
    conditions.push(scopeCondition.clause);
    params.push(...scopeCondition.params);

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const clusters: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        p.id,
        ST_X(p.location::geometry) as longitude,
        ST_Y(p.location::geometry) as latitude,
        p.status,
        p.block_id
      FROM potholes p
      ${whereClause}
    `, ...params);

    const features = clusters.map((c: any) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(c.longitude), Number(c.latitude)],
      },
      properties: {
        id: c.id,
        status: c.status,
        block_id: c.block_id,
      },
    }));

    const geojson = {
      type: "FeatureCollection",
      features,
    };

    let densityConditions = [`status = 'verified'`, `block_id IS NOT NULL`];
    let densityParams: any[] = [];

    densityConditions.push(densityScopeCondition.clause);
    densityParams.push(...densityScopeCondition.params);

    const densityWhere = `WHERE ${densityConditions.join(" AND ")}`;

    const blockDensity: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        block_id,
        COUNT(*)::bigint as count,
        AVG(ST_X(location::geometry)) as avg_longitude,
        AVG(ST_Y(location::geometry)) as avg_latitude
      FROM potholes
      ${densityWhere}
      GROUP BY block_id
    `, ...densityParams);

    res.json({
      potholes: geojson,
      blockDensity: blockDensity.map((b: any) => ({
        block_id: b.block_id,
        count: Number(b.count),
        avg_longitude: Number(b.avg_longitude),
        avg_latitude: Number(b.avg_latitude),
      })),
    });
  } catch (err: any) {
    logger.error({ err }, "Map clusters error");
    return res.status(500).json({ error: "Failed to fetch map data" });
  }
});

router.get("/tenders", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scopePrefix = getScopePrefix(req);
    let tenders: any[];

    if (scopePrefix) {
      tenders = await prisma.tender.findMany({
        where: {
          OR: [
            { block_id: scopePrefix },
            { block_id: { startsWith: `${scopePrefix}/` } },
          ],
        },
        orderBy: { generated_at: "desc" },
      });
    } else {
      // Fail closed: unresolved jurisdiction sees no tenders
      tenders = [];
    }

    res.json({ tenders });
  } catch (err: any) {
    logger.error({ err }, "Tenders error");
    return res.status(500).json({ error: "Failed to fetch tenders" });
  }
});

const updateTenderSchema = z.object({
  status: z.enum(["open", "assigned", "completed", "rejected"]),
});

router.patch("/tenders/:id", validate(updateTenderSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      return res.status(400).json({ error: "Invalid tender ID" });
    }
    const id = idResult.data;
    const scopeWhere = getPrismaScopeWhere(req);

    const updateResult = await prisma.tender.updateMany({
      where: { id, ...scopeWhere },
      data: { status },
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ error: "Tender not found" });
    }

    const tender = await prisma.tender.findUnique({ where: { id } });

    logger.info({ tenderId: id, newStatus: status, adminId: req.user!.userId }, "Tender status updated");
    res.json({ tender });
  } catch (err: any) {
    logger.error({ err }, "Update tender error");
    return res.status(500).json({ error: "Failed to update tender" });
  }
});

// ─── TENDER WEBSITE SYNC & SCHEDULING (ADMIN ONLY) ──────────────────────────

/** Derive the tender website's withdraw endpoint from the configured sync target URL. */
function withdrawUrlFromTarget(targetUrl: string): string {
  try {
    const parsed = new URL(targetUrl);
    const basePath = parsed.pathname.replace(/\/api\/sync\/?$/i, "");
    return `${parsed.origin}${basePath}/api/tenders`;
  } catch {
    return targetUrl;
  }
}

/**
 * Unsend a tender: marks it rejected in the backend (a rejected tender is
 * excluded from future scheduled syncs and cannot be re-created for the same
 * block) and removes it from the tender website. The DELETE dispatch is
 * best-effort — the next scheduled sync heals any failure because rejected
 * tenders are removed on ingestion.
 */
router.post("/tenders/:id/withdraw", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      return res.status(400).json({ error: "Invalid tender ID" });
    }
    const id = idResult.data;
    const scopeWhere = getPrismaScopeWhere(req);

    const tender = await prisma.tender.findFirst({ where: { id, ...scopeWhere } });
    if (!tender) {
      return res.status(404).json({ error: "Tender not found" });
    }
    if (tender.status !== "open") {
      return res.status(409).json({
        error: `Only open tenders can be withdrawn (current status: ${tender.status})`,
      });
    }

    const updateResult = await prisma.tender.updateMany({
      where: { id, status: "open", ...scopeWhere },
      data: { status: "rejected" },
    });
    if (updateResult.count === 0) {
      return res.status(409).json({
        error: "Tender is no longer open — it may have been accepted, completed or already withdrawn",
      });
    }

    const { getTenderSyncConfig } = await import("../services/tenderSyncService");
    const { settings } = await getTenderSyncConfig();

    let withdrawDispatched = false;
    let withdrawError: string | null = null;

    if (!settings.target_url || !settings.api_key) {
      withdrawError = "Tender website URL or API key not configured; withdrawal will reconcile on next scheduled sync";
      logger.warn({ tenderId: id }, withdrawError);
    } else {
      try {
        const response = await fetch(withdrawUrlFromTarget(settings.target_url), {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": settings.api_key,
            "Authorization": `Bearer ${settings.api_key}`,
          },
          body: JSON.stringify({
            tender_id: id,
            block_id: tender.block_id,
            triggered_by: `admin:${req.user?.userId || "admin"}`,
          }),
          signal: AbortSignal.timeout(15000),
        });
        withdrawDispatched = response.ok;
        if (!response.ok) {
          withdrawError = `Tender website withdraw call returned status ${response.status}; scheduled sync will reconcile`;
          logger.warn({ tenderId: id, status: response.status }, withdrawError);
        }
      } catch (dispatchErr: any) {
        withdrawError = `Failed to reach tender website: ${dispatchErr.message}; scheduled sync will reconcile`;
        logger.warn({ err: dispatchErr, tenderId: id }, withdrawError);
      }
    }

    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO tender_sync_logs (potholes_count, tenders_count, status, error_message, triggered_by)
        VALUES (0, 1, $1, $2, $3)
      `, withdrawDispatched ? "success" : "failed", withdrawError, `withdraw:admin:${req.user?.userId || "admin"}`);
    } catch (logErr) {
      logger.error({ err: logErr }, "Failed to write withdraw log");
    }

    const updated = await prisma.tender.findUnique({ where: { id } });
    logger.info({ tenderId: id, adminId: req.user!.userId, withdrawDispatched }, "Tender withdrawn (unsent)");
    res.json({ success: true, tender: updated, withdraw_dispatched: withdrawDispatched });
  } catch (err: any) {
    logger.error({ err }, "Withdraw tender error");
    return res.status(500).json({ error: "Failed to withdraw tender" });
  }
});

const updateSyncConfigSchema = z.object({
  target_url: z.string().url().optional(),
  api_key: z.string().min(6).optional(),
  sync_interval_days: z.number().int().min(15).max(30).optional(),
  is_enabled: z.boolean().optional(),
});

router.get("/tender-sync", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isStateScopeAdmin(req)) {
      return res.status(403).json({ error: "Tender sync is managed by state-level admins only" });
    }
    const { getTenderSyncConfig } = await import("../services/tenderSyncService");
    const data = await getTenderSyncConfig();
    res.json(data);
  } catch (err: any) {
    logger.error({ err }, "Fetch tender sync config error");
    res.status(500).json({ error: "Failed to fetch tender sync configuration" });
  }
});

router.put("/tender-sync", validate(updateSyncConfigSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isStateScopeAdmin(req)) {
      return res.status(403).json({ error: "Tender sync is managed by state-level admins only" });
    }
    const { updateTenderSyncConfig } = await import("../services/tenderSyncService");
    const updated = await updateTenderSyncConfig(req.body);
    logger.info({ adminId: req.user?.userId, config: req.body }, "Tender sync settings updated");
    res.json({ settings: updated });
  } catch (err: any) {
    logger.error({ err }, "Update tender sync config error");
    res.status(500).json({ error: "Failed to update tender sync configuration" });
  }
});

router.post("/tender-sync/trigger", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isStateScopeAdmin(req)) {
      return res.status(403).json({ error: "Tender sync is managed by state-level admins only" });
    }
    const { performTenderSync } = await import("../services/tenderSyncService");
    const adminIdentifier = req.user?.userId || "admin";
    const result = await performTenderSync(`admin:${adminIdentifier}`);
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "Trigger tender sync error");
    res.status(500).json({ error: "Failed to perform tender sync" });
  }
});

export default router;
