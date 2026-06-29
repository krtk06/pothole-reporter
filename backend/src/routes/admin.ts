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

router.get("/reports", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = statusFilterSchema.safeParse(req.query);
    const status = parsed.success ? parsed.data.status : undefined;

    let query = `
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
    `;
    const params: any[] = [];
    if (status) {
      query += ` WHERE p.status = $1::text::"ReportStatus"`;
      params.push(status);
    }
    query += ` ORDER BY p.created_at DESC`;

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

    const result: any[] = await prisma.$queryRawUnsafe(`
      UPDATE potholes SET status = $1::text::"ReportStatus" WHERE id = $2::uuid RETURNING id, status
    `, status, id);

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
    const clusters: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        p.id,
        ST_X(p.location::geometry) as longitude,
        ST_Y(p.location::geometry) as latitude,
        p.status,
        p.block_id
      FROM potholes p
      WHERE p.status = 'verified'
    `);

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

    const blockDensity: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        block_id,
        COUNT(*)::bigint as count,
        AVG(ST_X(location::geometry)) as avg_longitude,
        AVG(ST_Y(location::geometry)) as avg_latitude
      FROM potholes
      WHERE status = 'verified' AND block_id IS NOT NULL
      GROUP BY block_id
    `);

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
    const tenders = await getTenders();
    res.json({ tenders });
  } catch (err: any) {
    logger.error({ err }, "Tenders error");
    return res.status(500).json({ error: "Failed to fetch tenders" });
  }
});

const updateTenderSchema = z.object({
  status: z.enum(["open", "assigned", "completed"]),
});

router.patch("/tenders/:id", validate(updateTenderSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      return res.status(400).json({ error: "Invalid tender ID" });
    }
    const id = idResult.data;

    const tender = await prisma.tender.update({
      where: { id },
      data: { status },
    });

    logger.info({ tenderId: id, newStatus: status, adminId: req.user!.userId }, "Tender status updated");
    res.json({ tender });
  } catch (err: any) {
    logger.error({ err }, "Update tender error");
    return res.status(500).json({ error: "Failed to update tender" });
  }
});

export default router;
