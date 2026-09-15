import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/database";
import logger from "../config/logger";
import { generatePresignedDownloadUrl } from "../services/s3Service";

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

/**
 * GET /api/v1/public/potholes
 * Returns verified potholes (public view - no reporter info, no images).
 * Optional query params: ?state=&district=&mandal= (filter by block_id prefix)
 * Also returns pending potholes count per block for the mini-map.
 */
router.get("/potholes", async (req: Request, res: Response) => {
  try {
    const parsedQuery = locationQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: "Invalid location filter" });
    }
    const { state, district, mandal } = parsedQuery.data;

    // Build block_id prefix filter
    let blockPrefix: string | null = null;
    if (mandal && district && state) {
      blockPrefix = `${state.toLowerCase()}/${district.toLowerCase()}/${mandal.toLowerCase()}`;
    } else if (district && state) {
      blockPrefix = `${state.toLowerCase()}/${district.toLowerCase()}`;
    } else if (state) {
      blockPrefix = state.toLowerCase();
    }

    let query: string;
    let params: any[];

    if (blockPrefix) {
      query = `
        SELECT
          p.id,
          ST_X(p.location::geometry) as longitude,
          ST_Y(p.location::geometry) as latitude,
          p.status,
          p.block_id,
          p.created_at
        FROM potholes p
        WHERE p.status IN ('verified', 'pending')
          AND (p.block_id = $1 OR p.block_id LIKE $2)
        ORDER BY p.created_at DESC
        LIMIT 500
      `;
      params = [blockPrefix, `${blockPrefix}/%`];
    } else {
      query = `
        SELECT
          p.id,
          ST_X(p.location::geometry) as longitude,
          ST_Y(p.location::geometry) as latitude,
          p.status,
          p.block_id,
          p.created_at
        FROM potholes p
        WHERE p.status = 'verified'
        ORDER BY p.created_at DESC
        LIMIT 1000
      `;
      params = [];
    }

    const potholes: any[] = await prisma.$queryRawUnsafe(query, ...params);

    res.json({
      potholes: potholes.map((p) => ({
        id: p.id,
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        status: p.status,
        block_id: p.block_id,
        created_at: p.created_at,
      })),
    });
  } catch (err: any) {
    logger.error({ err }, "Public potholes error");
    return res.status(500).json({ error: "Failed to fetch potholes" });
  }
});

/**
 * GET /api/v1/public/tenders
 * Live public feed for the tender website: real tenders from Postgres
 * (excluding withdrawn/rejected) with verified potholes per block and FRESH
 * AWS S3 presigned evidence URLs generated at request time (valid ~15 min).
 * No auth — safe public subset only (no reporter contact details).
 * Returns { tenders, last_sync_at } — empty array when nothing is available.
 */
router.get("/tenders", async (_req: Request, res: Response) => {
  try {
    const tenders: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, block_id, pothole_count, estimated_cost, status, generated_at
      FROM tenders
      WHERE status IN ('open', 'assigned', 'completed')
      ORDER BY generated_at DESC
      LIMIT 100
    `);

    const cap = (s: string) =>
      s.split(" ").map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
    const districtMandal = (blockId?: string | null) => {
      if (!blockId) return { district: "General", mandal: "Central" };
      const parts = blockId.split("/");
      if (parts.length >= 3) return { district: cap(parts[1]), mandal: cap(parts[2]) };
      if (parts.length === 2) return { district: cap(parts[1]), mandal: "General" };
      return { district: cap(blockId), mandal: "Central" };
    };

    const live = await Promise.all(
      tenders.map(async (t: any) => {
        const { district, mandal } = districtMandal(t.block_id);
        let potholes: any[] = [];
        try {
          potholes = await prisma.$queryRawUnsafe(
            `
            SELECT
              p.id, p.image_s3_key,
              ST_X(p.location::geometry) as longitude,
              ST_Y(p.location::geometry) as latitude,
              p.address_notes, p.block_id, p.status, p.created_at,
              u.name as reporter_name
            FROM potholes p
            JOIN users u ON u.id = p.reporter_id
            WHERE p.block_id = $1 AND p.status = 'verified'
            ORDER BY p.created_at DESC
            LIMIT 50
            `,
            t.block_id
          );
        } catch (e) {
          logger.warn({ err: e, blockId: t.block_id }, "Live tender potholes lookup failed");
        }

        const enriched = await Promise.all(
          potholes.map(async (p: any) => ({
            id: p.id,
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
            address_notes: p.address_notes,
            block_id: p.block_id,
            status: p.status,
            created_at: p.created_at,
            reporter_name: p.reporter_name,
            image_s3_key: p.image_s3_key,
            image_url: await generatePresignedDownloadUrl(p.image_s3_key).catch(() => null),
          }))
        );

        const generatedAt = t.generated_at instanceof Date ? t.generated_at : new Date(t.generated_at);
        return {
          id: t.id,
          block_id: t.block_id,
          district,
          mandal,
          title: `${district} (${mandal}) Road Restoration Tender`,
          description: `Official road rehabilitation and pothole filling package for ${mandal} mandal, ${district} district.`,
          pothole_count: enriched.length > 0 ? enriched.length : Number(t.pothole_count),
          estimated_cost: Number(t.estimated_cost),
          status: t.status === "assigned" || t.status === "completed" ? t.status : "open",
          generated_at: generatedAt.toISOString(),
          deadline: new Date(generatedAt.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(),
          potholes: enriched,
        };
      })
    );

    res.json({ tenders: live, last_sync_at: new Date().toISOString(), source: "postgres+aws-s3-live" });
  } catch (err: any) {
    logger.error({ err }, "Public live tenders error");
    return res.status(500).json({ error: "Failed to fetch live tenders" });
  }
});

export default router;
