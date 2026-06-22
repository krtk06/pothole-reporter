import { Router, Response } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/rbac";
import prisma from "../config/database";
import { getTenders } from "../services/tenderService";
import { generatePresignedDownloadUrl } from "../services/s3Service";
import { AuthenticatedRequest } from "../types";

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/reports", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.query;
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
    console.error("Admin reports error:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
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
    console.error("Map clusters error:", err);
    res.status(500).json({ error: "Failed to fetch map data" });
  }
});

router.get("/tenders", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenders = await getTenders();
    res.json({ tenders });
  } catch (err: any) {
    console.error("Tenders error:", err);
    res.status(500).json({ error: "Failed to fetch tenders" });
  }
});

export default router;
