import { Router, Request, Response } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { uploadLimiter } from "../middleware/rateLimiter";
import logger from "../config/logger";
import { AuthenticatedRequest } from "../types";
import prisma from "../config/database";
import { EVIDENCE_METADATA_DIR, UPLOADS_DIR } from "../config/paths";
import { resolveBlockIdFromCoordinates } from "../services/geoService";
import { analyzeEvidenceWithPrivateAi } from "../services/privateAiService";

const router = Router();

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov"]);
const ALLOWED_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);

function safeExtension(originalName: string, mimetype: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) return ext;
  if (mimetype === "image/png") return ".png";
  if (mimetype === "image/webp") return ".webp";
  if (mimetype === "video/mp4") return ".mp4";
  if (mimetype === "video/quicktime") return ".mov";
  return ".jpg";
}

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    cb(null, `${uuid()}${safeExtension(file.originalname, file.mimetype)}`);
  },
});

function looksLikeMedia(filePath: string, mimetype: string): boolean {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(16);
    const bytes = fs.readSync(fd, buffer, 0, 16, 0);
    if (bytes < 8) return false;
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    const isWebp =
      buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    const isMp4 = buffer.toString("ascii", 4, 8) === "ftyp";
    if (mimetype.startsWith("image/")) return isJpeg || isPng || isWebp;
    if (mimetype.startsWith("video/")) return isMp4;
    return false;
  } finally {
    fs.closeSync(fd);
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!file.mimetype.startsWith("image/") || !IMAGE_EXTENSIONS.has(ext)) {
      cb(new Error("Only JPG, PNG and WebP images are allowed"));
      return;
    }
    cb(null, true);
  },
});

const evidenceUpload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024, files: 1, fieldSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isImage = file.mimetype.startsWith("image/") && IMAGE_EXTENSIONS.has(ext);
    const isVideo = file.mimetype.startsWith("video/") && VIDEO_EXTENSIONS.has(ext);
    if (!isImage && !isVideo) {
      cb(new Error("Only JPG, PNG, WebP, MP4 and MOV files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const locationSampleSchema = z.object({
  elapsedMs: z.number().int().min(0),
  capturedAt: z.string().datetime(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable(),
  altitude: z.number().nullable(),
  heading: z.number().nullable(),
  speed: z.number().nullable(),
});

const motionVectorSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const evidenceMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  captureId: z.string().min(8).max(100),
  mode: z.enum(["single", "road"]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().positive().max(24 * 60 * 60 * 1000),
  locationTrack: z.array(locationSampleSchema).min(1).max(20_000),
  motionTrack: z.array(z.object({
    elapsedMs: z.number().int().min(0),
    capturedAt: z.string().datetime(),
    accelerometer: motionVectorSchema.optional(),
    gyroscope: motionVectorSchema.optional(),
  })).max(50_000),
  captureEndReason: z.enum(["manual", "stationary"]).optional(),
  movementDetected: z.boolean().optional(),
}).superRefine((metadata, context) => {
  if (metadata.mode === "single" && metadata.locationTrack.length !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["locationTrack"],
      message: "A single photo requires exactly one coordinate",
    });
  }

  const timelines = [metadata.locationTrack, metadata.motionTrack];
  for (const timeline of timelines) {
    for (let index = 1; index < timeline.length; index += 1) {
      if (timeline[index].elapsedMs < timeline[index - 1].elapsedMs) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Evidence timelines must be ordered by elapsedMs",
        });
        return;
      }
    }
    if (timeline.some((sample) => sample.elapsedMs > metadata.durationMs + 5000)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Evidence timeline exceeds the capture duration",
      });
      return;
    }
  }
});

router.post(
  "/local",
  authenticate,
  uploadLimiter,
  (req: Request, res: Response) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        logger.error({ err }, "Local upload error");
        res.status(400).json({ error: err.message || "Upload failed" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }
      if (!looksLikeMedia(req.file.path, req.file.mimetype)) {
        void fs.promises.unlink(req.file.path).catch(() => undefined);
        res.status(400).json({ error: "File content does not match its declared image type" });
        return;
      }
      const key = `uploads/${req.file.filename}`;
      res.json({ uploadUrl: "", key });
    });
  },
);

router.post(
  "/evidence",
  authenticate,
  uploadLimiter,
  (req: Request, res: Response) => {
    evidenceUpload.single("media")(req, res, async (err: any) => {
      if (err) {
        logger.error({ err }, "Evidence upload error");
        return res.status(400).json({ error: err.message || "Upload failed" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No photo or video was provided" });
      }

      if (!looksLikeMedia(req.file.path, req.file.mimetype)) {
        await fs.promises.unlink(req.file.path).catch(() => undefined);
        return res.status(400).json({ error: "File content does not match its declared media type" });
      }

      const parsedJson = (() => {
        try {
          return JSON.parse(String(req.body.metadata || ""));
        } catch {
          return null;
        }
      })();
      const parsed = evidenceMetadataSchema.safeParse(parsedJson);
      const mediaMatchesMode = parsed.success && (
        (parsed.data.mode === "single" && req.file.mimetype.startsWith("image/")) ||
        (parsed.data.mode === "road" && req.file.mimetype.startsWith("video/"))
      );
      if (!parsed.success || !mediaMatchesMode) {
        await fs.promises.unlink(req.file.path).catch(() => undefined);
        return res.status(400).json({
          error: parsed.success
            ? "The media type does not match the capture mode"
            : "Invalid evidence metadata",
        });
      }

      const metadataFilename = `${path.parse(req.file.filename).name}.json`;
      await fs.promises.mkdir(EVIDENCE_METADATA_DIR, { recursive: true });
      const metadataPath = path.join(EVIDENCE_METADATA_DIR, metadataFilename);

      try {
        const authenticatedRequest = req as AuthenticatedRequest;
        const firstLocation = parsed.data.locationTrack[0];
        const blockId = await resolveBlockIdFromCoordinates(
          firstLocation.latitude,
          firstLocation.longitude,
        );

        const evidenceEnvelope = {
          evidenceId: parsed.data.captureId,
          reporterId: authenticatedRequest.user!.userId,
          receivedAt: new Date().toISOString(),
          mediaKey: `uploads/${req.file.filename}`,
          capture: parsed.data,
        };
        await fs.promises.writeFile(metadataPath, JSON.stringify(evidenceEnvelope, null, 2), "utf8");

        const report: any[] = await prisma.$queryRawUnsafe(
          `INSERT INTO potholes (
             id, reporter_id, image_s3_key, report_type, evidence_metadata,
             location, address_notes, block_id, status, created_at
           )
           VALUES (
             gen_random_uuid(), $1::uuid, $2, $3, $4::jsonb,
             ST_SetSRID(ST_MakePoint($5, $6), 4326), NULL, $7, 'pending', NOW()
           )
           RETURNING id, status`,
          authenticatedRequest.user!.userId,
          evidenceEnvelope.mediaKey,
          parsed.data.mode,
          JSON.stringify(parsed.data),
          firstLocation.longitude,
          firstLocation.latitude,
          blockId,
        );

        void analyzeEvidenceWithPrivateAi({
          reportId: report[0].id,
          filePath: req.file.path,
          mediaType: req.file.mimetype,
          mode: parsed.data.mode,
          latitude: firstLocation.latitude,
          longitude: firstLocation.longitude,
        });

        return res.status(201).json({
          evidence_id: parsed.data.captureId,
          report_id: report[0].id,
          media_key: `uploads/${req.file.filename}`,
          metadata_key: `uploads/.metadata/${metadataFilename}`,
          status: "pending",
          analysis_state: "processing",
          canonical_issue_id: null,
        });
      } catch (writeError) {
        await fs.promises.unlink(req.file.path).catch(() => undefined);
        await fs.promises.unlink(metadataPath).catch(() => undefined);
        logger.error({ err: writeError }, "Evidence metadata write error");
        return res.status(500).json({ error: "Could not store evidence metadata" });
      }
    });
  },
);

export default router;
