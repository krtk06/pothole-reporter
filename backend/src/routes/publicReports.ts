import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/database";
import logger from "../config/logger";
import { generatePresignedDownloadUrl } from "../services/s3Service";
import { publicReadLimiter } from "../middleware/rateLimiter";

const router = Router();

const locationPart = z.string().trim().min(1).max(100).regex(/^[a-z0-9][a-z0-9 -]*$/i);
const locationQuerySchema = z.object({
  state: locationPart.optional(),
  district: locationPart.optional(),
  mandal: locationPart.optional(),
}).refine((value) => !value.district || Boolean(value.state), {
  message: "district requires state",
  path: ["district"],
}).refine((value) => !value.mandal || Boolean(value.state && value.district), {
  message: "mandal requires state and district",
  path: ["mandal"],
});

function blockPrefix(state?: string, district?: string, mandal?: string): string | null {
  const parts = [state, district, mandal]
    .map((part) => (part || "").trim().replace(/\s+/g, " ").toLowerCase())
    .filter(Boolean);
  return parts.length ? parts.join("/") : null;
}

router.get("/potholes", publicReadLimiter, async (req: Request, res: Response) => {
  try {
    const parsedQuery = locationQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) return res.status(400).json({ error: "Invalid location filter" });
    const { state, district, mandal } = parsedQuery.data;
    const prefix = blockPrefix(state, district, mandal);

    const blockClause = prefix ? `AND (block_id = $1 OR block_id LIKE $2)` : "";
    const params = prefix ? [prefix, `${prefix}/%`] : [];

    const issues: any[] = await prisma.$queryRawUnsafe(
      `SELECT
         id,
         ST_Y(location::geometry) AS latitude,
         ST_X(location::geometry) AS longitude,
         status,
         condition,
         severity_score,
         pothole_count,
         evidence_count,
         block_id,
         first_detected_at AS created_at,
         last_detected_at
       FROM road_issues
       WHERE status <> 'dismissed' ${blockClause}
       ORDER BY last_detected_at DESC
       LIMIT 1000`,
      ...params,
    );

    const pending: any[] = await prisma.$queryRawUnsafe(
      `SELECT
         id,
         ST_Y(location::geometry) AS latitude,
         ST_X(location::geometry) AS longitude,
         'pending' AS status,
         NULL::varchar AS condition,
         NULL::numeric AS severity_score,
         NULL::integer AS pothole_count,
         1 AS evidence_count,
         block_id,
         created_at,
         created_at AS last_detected_at
       FROM potholes
       WHERE status = 'pending'
         AND canonical_issue_id IS NULL ${blockClause}
       ORDER BY created_at DESC
       LIMIT 500`,
      ...params,
    );

    res.json({
      potholes: [
        ...issues.map((row) => ({
          id: row.id,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          status: row.status === "active" ? "verified" : row.status === "fixed" ? "fixed" : "rejected",
          condition: row.condition,
          severity_score: row.severity_score === null ? null : Number(row.severity_score),
          pothole_count: row.pothole_count === null ? null : Number(row.pothole_count),
          evidence_count: Number(row.evidence_count || 1),
          block_id: row.block_id,
          created_at: row.created_at,
          last_detected_at: row.last_detected_at,
        })),
        ...pending.map((row) => ({
          id: row.id,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          status: "pending",
          condition: null,
          severity_score: null,
          pothole_count: null,
          evidence_count: 1,
          block_id: row.block_id,
          created_at: row.created_at,
          last_detected_at: row.last_detected_at,
        })),
      ],
    });
  } catch (err) {
    logger.error({ err }, "Public potholes error");
    return res.status(500).json({ error: "Failed to fetch potholes" });
  }
});

router.get("/tenders", publicReadLimiter, async (_req: Request, res: Response) => {
  try {
    const tenders: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, block_id, pothole_count, estimated_cost, status, generated_at
      FROM tenders
      WHERE status IN ('open', 'assigned', 'completed')
      ORDER BY generated_at DESC
      LIMIT 100
    `);

    const cap = (s: string) => s.split(" ").map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
    const districtMandal = (blockId?: string | null) => {
      if (!blockId) return { district: "General", mandal: "Central" };
      const parts = blockId.split("/");
      if (parts.length >= 3) return { district: cap(parts[1]), mandal: cap(parts[2]) };
      if (parts.length === 2) return { district: cap(parts[1]), mandal: "General" };
      return { district: cap(blockId), mandal: "Central" };
    };

    const live = await Promise.all(
      tenders.map(async (t) => {
        const { district, mandal } = districtMandal(t.block_id);
        let potholes: any[] = [];
        try {
          potholes = await prisma.$queryRawUnsafe(
            `SELECT p.id, p.image_s3_key,
                    ST_X(p.location::geometry) AS longitude,
                    ST_Y(p.location::geometry) AS latitude,
                    p.address_notes, p.block_id, p.status, p.created_at
             FROM potholes p
             WHERE p.block_id = $1 AND p.status = 'verified'
             ORDER BY p.created_at DESC
             LIMIT 50`,
            t.block_id,
          );
        } catch (err) {
          logger.warn({ err, blockId: t.block_id }, "Public tender potholes lookup failed");
        }

        const enriched = await Promise.all(
          potholes.map(async (p) => ({
            id: p.id,
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
            address_notes: p.address_notes,
            block_id: p.block_id,
            status: p.status,
            created_at: p.created_at,
            image_s3_key: p.image_s3_key,
            image_url: await generatePresignedDownloadUrl(p.image_s3_key).catch(() => null),
          })),
        );

        const generatedAt = t.generated_at instanceof Date ? t.generated_at : new Date(t.generated_at);
        return {
          id: t.id,
          block_id: t.block_id,
          district,
          mandal,
          title: `${district} (${mandal}) Road Restoration Tender`,
          description: `Official road rehabilitation and pothole filling package for ${mandal} mandal, ${district} district.`,
          pothole_count: enriched.length || Number(t.pothole_count),
          estimated_cost: Number(t.estimated_cost),
          status: t.status === "assigned" || t.status === "completed" ? t.status : "open",
          generated_at: generatedAt.toISOString(),
          deadline: new Date(generatedAt.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(),
          potholes: enriched,
        };
      }),
    );

    res.json({ tenders: live, last_sync_at: new Date().toISOString(), source: "postgres+aws-s3-live" });
  } catch (err) {
    logger.error({ err }, "Public live tenders error");
    return res.status(500).json({ error: "Failed to fetch live tenders" });
  }
});

export default router;
