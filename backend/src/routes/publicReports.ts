import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/database";
import logger from "../config/logger";

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

export default router;
