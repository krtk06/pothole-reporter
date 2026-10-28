import { Router, Response } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { uploadLimiter } from "../middleware/rateLimiter";
import prisma from "../config/database";
import logger from "../config/logger";
import { AuthenticatedRequest } from "../types";
import { UPLOADS_DIR } from "../config/paths";
import { resolveBlockIdIfMissing } from "../services/geoService";
import { analyzeEvidenceWithPrivateAi } from "../services/privateAiService";

const router = Router();

const reportSchema = z.object({
  s3_key: z.string().min(1).max(255).regex(/^uploads\//, "Upload key must start with uploads/"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  notes: z.string().max(2000).optional(),
  block_id: z.string().trim().min(1).max(100).regex(/^[a-z0-9][a-z0-9 /-]*$/i).optional(),
}).refine((data) => !(data.latitude === 0 && data.longitude === 0), {
  message: "Valid location is required",
  path: ["latitude"],
});

function localEvidencePath(key: string): string | null {
  const normalized = key.replace(/\\/g, "/");
  if (!normalized.startsWith("uploads/")) return null;
  const filename = path.basename(normalized);
  if (!filename || filename === "." || filename === "..") return null;
  const resolved = path.join(UPLOADS_DIR, filename);
  const relative = path.relative(UPLOADS_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

router.post(
  "/",
  authenticate,
  uploadLimiter,
  validate(reportSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { s3_key, latitude, longitude, notes, block_id } = req.body;
      const userId = req.user!.userId;
      const resolvedBlockId = await resolveBlockIdIfMissing(block_id, latitude, longitude);

      const report: any[] = await prisma.$queryRawUnsafe(
        `INSERT INTO potholes (id, reporter_id, image_s3_key, location, address_notes, block_id, status, created_at)
         VALUES (
           gen_random_uuid(),
           $1::uuid,
           $2,
           ST_SetSRID(ST_MakePoint($3, $4), 4326),
           $5,
           $6,
           'pending',
           NOW()
         )
         RETURNING id, status, block_id`,
        userId,
        s3_key,
        longitude,
        latitude,
        notes || null,
        resolvedBlockId,
      );

      // Analyse a local copy when one exists. If the private AI worker is
      // unreachable the report stays pending; this call never rejects the
      // report and is intentionally not awaited.
      const filePath = localEvidencePath(s3_key);
      if (filePath && fs.existsSync(filePath)) {
        void analyzeEvidenceWithPrivateAi({
          reportId: report[0].id,
          filePath,
          mediaType: "image/jpeg",
          mode: "single",
          latitude,
          longitude,
        }).catch((err) => logger.warn({ err, reportId: report[0].id }, "AI analysis failed; report remains pending"));
      }

      res.status(201).json({
        report_id: report[0].id,
        status: report[0].status,
        block_id: report[0].block_id ?? null,
        block_resolved: !block_id && !!report[0].block_id,
      });
    } catch (err: any) {
      logger.error({ err }, "Report submission error");
      return res.status(500).json({ error: "Failed to submit report" });
    }
  },
);

router.get("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reports = await prisma.$queryRaw`
      SELECT
        p.id,
        p.image_s3_key,
        p.report_type,
        ST_X(p.location::geometry) as longitude,
        ST_Y(p.location::geometry) as latitude,
        p.address_notes,
        p.status,
        p.deduplication_state,
        p.canonical_issue_id,
        p.ai_result,
        p.block_id,
        p.created_at
      FROM potholes p
      WHERE p.reporter_id = ${req.user!.userId}::uuid
      ORDER BY p.created_at DESC
    `;

    res.json({ reports });
  } catch (err: any) {
    logger.error({ err }, "Fetch reports error");
    return res.status(500).json({ error: "Failed to fetch reports" });
  }
});

export default router;
