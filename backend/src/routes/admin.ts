import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/rbac";
import { validate } from "../middleware/validate";
import prisma from "../config/database";
import logger from "../config/logger";
import { getTenders } from "../services/tenderService";
import { generatePresignedDownloadUrl } from "../services/s3Service";
import { AuthenticatedRequest } from "../types";

const router = Router();

router.use(authenticate, requireAdmin);

const statusFilterSchema = z.object({
  status: z.enum(["pending", "verified", "rejected", "fixed"]).optional(),
});

/** Build scope prefix string for tender filtering */
function getScopePrefix(req: AuthenticatedRequest): string | null {
  const scope = req.user?.admin_scope;
  const state = req.user?.admin_state;
  const district = req.user?.admin_district;
  const mandal = req.user?.admin_mandal;

  if (!scope || !state) return null;

  if (scope === "mandal" && district && mandal) {
    return `${state.toLowerCase()}/${district.toLowerCase()}/${mandal.toLowerCase()}`;
  } else if (scope === "district" && district) {
    return `${state.toLowerCase()}/${district.toLowerCase()}`;
  }
  return state.toLowerCase();
}

function getScopeCondition(scopePrefix: string | null, column: string, parameterIndex: number) {
  if (!scopePrefix) return { clause: "", params: [] as string[] };
  return {
    clause: `(${column} = $${parameterIndex} OR ${column} LIKE $${parameterIndex + 1})`,
    params: [scopePrefix, `${scopePrefix}/%`],
  };
}

router.get("/reports", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = statusFilterSchema.safeParse(req.query);
    const status = parsed.success ? parsed.data.status : undefined;
    const scopePrefix = getScopePrefix(req);

    let conditions: string[] = [];
    let params: any[] = [];
    let paramIdx = 1;

    if (status) {
      conditions.push(`p.status = $${paramIdx}::text::"ReportStatus"`);
      params.push(status);
      paramIdx++;
    }

    if (scopePrefix) {
      const scopeCondition = getScopeCondition(scopePrefix, "p.block_id", paramIdx);
      conditions.push(scopeCondition.clause);
      params.push(...scopeCondition.params);
      paramIdx += 2;
    }

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
    const scopeCondition = getScopeCondition(getScopePrefix(req), "block_id", 3);

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
    const scopePrefix = getScopePrefix(req);

    let conditions = [`p.status = 'verified'`];
    let params: any[] = [];

    if (scopePrefix) {
      const scopeCondition = getScopeCondition(scopePrefix, "p.block_id", 1);
      conditions.push(scopeCondition.clause);
      params.push(...scopeCondition.params);
    }

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

    if (scopePrefix) {
      const scopeCondition = getScopeCondition(scopePrefix, "block_id", 1);
      densityConditions.push(scopeCondition.clause);
      densityParams.push(...scopeCondition.params);
    }

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
    let tenders;

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
      tenders = await getTenders();
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
    const scopePrefix = getScopePrefix(req);
    const scopeWhere = scopePrefix
      ? {
          OR: [
            { block_id: scopePrefix },
            { block_id: { startsWith: `${scopePrefix}/` } },
          ],
        }
      : {};

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

export default router;
