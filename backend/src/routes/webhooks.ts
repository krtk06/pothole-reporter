import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import prisma from "../config/database";
import { checkAndGenerateTender } from "../services/tenderService";

const router = Router();

const mlWebhookSchema = z.object({
  report_id: z.string().uuid(),
  is_valid: z.boolean(),
  confidence_score: z.number().min(0).max(1),
});

function verifyInternalApiKey(req: Request, res: Response, next: Function): void {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.ML_WEBHOOK_SECRET) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }
  next();
}

router.post(
  "/ml-validation",
  verifyInternalApiKey,
  validate(mlWebhookSchema),
  async (req: Request, res: Response) => {
    try {
      const { report_id, is_valid, confidence_score } = req.body;

      const newStatus = is_valid ? "verified" : "rejected";
      const report: any[] = await prisma.$queryRawUnsafe(`
        UPDATE potholes
        SET status = $1::text::"ReportStatus"
        WHERE id = $2::uuid
        RETURNING block_id
      `, newStatus, report_id);

      let tenderGenerated = false;

      if (is_valid && report[0]?.block_id) {
        tenderGenerated = await checkAndGenerateTender(report[0].block_id);
      }

      res.json({ success: true, tender_generated: tenderGenerated });
    } catch (err: any) {
      console.error("ML webhook error:", err);
      res.status(500).json({ error: "Failed to process ML validation" });
    }
  }
);

export default router;
