import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import prisma from "../config/database";
import { AuthenticatedRequest } from "../types";

const router = Router();

const reportSchema = z.object({
  s3_key: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  notes: z.string().optional(),
});

router.post(
  "/",
  authenticate,
  validate(reportSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { s3_key, latitude, longitude, notes } = req.body;
      const userId = req.user!.userId;

      const report: any[] = await prisma.$queryRawUnsafe(`
        INSERT INTO potholes (id, reporter_id, image_s3_key, location, address_notes, status, created_at)
        VALUES (
          gen_random_uuid(),
          $1::uuid,
          $2,
          ST_SetSRID(ST_MakePoint($3, $4), 4326),
          $5,
          'pending',
          NOW()
        )
        RETURNING id, status
      `, userId, s3_key, longitude, latitude, notes || null);

      res.status(201).json({
        report_id: report[0].id,
        status: report[0].status,
      });
    } catch (err: any) {
      console.error("Report submission error:", err);
      res.status(500).json({ error: "Failed to submit report" });
    }
  }
);

router.get("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reports = await prisma.$queryRaw`
      SELECT
        p.id,
        p.image_s3_key,
        ST_X(p.location::geometry) as longitude,
        ST_Y(p.location::geometry) as latitude,
        p.address_notes,
        p.status,
        p.block_id,
        p.created_at
      FROM potholes p
      WHERE p.reporter_id = ${req.user!.userId}::uuid
      ORDER BY p.created_at DESC
    `;

    res.json({ reports });
  } catch (err: any) {
    console.error("Fetch reports error:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

export default router;
