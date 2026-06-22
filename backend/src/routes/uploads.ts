import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { uploadLimiter } from "../middleware/rateLimiter";
import { generatePresignedUploadUrl } from "../services/s3Service";

const router = Router();

const presignedUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^image\//, "Must be an image type"),
});

router.post(
  "/presigned-url",
  authenticate,
  uploadLimiter,
  validate(presignedUrlSchema),
  async (req: Request, res: Response) => {
    try {
      const { filename, contentType } = req.body;
      const result = await generatePresignedUploadUrl(filename, contentType);
      res.json(result);
    } catch (err: any) {
      console.error("S3 presigned URL error:", err);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  }
);

export default router;
