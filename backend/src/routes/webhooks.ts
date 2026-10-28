import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { validate } from "../middleware/validate";
import prisma from "../config/database";
import logger from "../config/logger";
import { checkAndGenerateTender, hasOpenTender } from "../services/tenderService";
import { pushBlockToTenderWebsite } from "../services/tenderSyncService";
import { ensureRoadIssueForReport, recordAiRoadAnalysis, RoadCondition } from "../services/roadIssueRegistry";

const router = Router();

const mlWebhookSchema = z.object({
  report_id: z.string().uuid(),
  is_valid: z.boolean(),
  confidence_score: z.number().min(0).max(1),
  condition: z.enum(["pothole", "crack", "unpaved_or_heavy_damage"]).optional(),
  severity_score: z.number().min(0).max(100).optional(),
  estimated_pothole_count: z.number().int().min(0).max(100).optional(),
  model_version: z.string().max(128).optional(),
  details: z.record(z.unknown()).optional(),
});

function verifyInternalApiKey(req: Request, res: Response, next: Function): void {
  const webhookSecret = process.env.ML_WEBHOOK_SECRET;
  if (!webhookSecret) {
    res.status(500).json({ error: "Webhook not configured on server" });
    return;
  }
  const apiKey = req.headers["x-api-key"];
  if (typeof apiKey !== "string") {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }
  const expected = Buffer.from(webhookSecret);
  const actual = Buffer.from(apiKey);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }
  next();
}

async function blockForReport(reportId: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ block_id: string | null }>>(
    `SELECT block_id FROM potholes WHERE id = $1::uuid`,
    reportId,
  );
  return rows[0]?.block_id || null;
}

router.post(
  "/ml-validation",
  verifyInternalApiKey,
  validate(mlWebhookSchema),
  async (req: Request, res: Response) => {
    try {
      const {
        report_id,
        is_valid,
        condition,
        severity_score,
        estimated_pothole_count,
        confidence_score,
        model_version,
        details,
      } = req.body;

      const exists = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM potholes WHERE id = $1::uuid`,
        report_id,
      );
      if (exists.length === 0) return res.status(404).json({ error: "Report not found" });

      if (condition && severity_score !== undefined && estimated_pothole_count !== undefined) {
        const result = await recordAiRoadAnalysis(report_id, {
          condition: condition as RoadCondition,
          severityScore: severity_score,
          potholeCount: is_valid ? estimated_pothole_count : 0,
          confidence: confidence_score,
          modelVersion: model_version,
          details,
        });
        let tenderGenerated = false;
        const blockId = await blockForReport(report_id);
        if (result.issueId && blockId) {
          tenderGenerated = await checkAndGenerateTender(blockId);
          if (tenderGenerated || await hasOpenTender(blockId)) {
            await pushBlockToTenderWebsite(blockId, "webhook:ml-validation").catch(() => undefined);
          }
        }
        return res.json({
          success: true,
          canonical_issue_id: result.issueId,
          reused_existing_issue: result.reused,
          tender_generated: tenderGenerated,
          block_id: blockId,
        });
      }

      const newStatus = is_valid ? "verified" : "rejected";
      const report: any[] = await prisma.$queryRawUnsafe(
        `UPDATE potholes
         SET status = $1::text::"ReportStatus",
             deduplication_state = $2::"DeduplicationState"
         WHERE id = $3::uuid AND status <> 'fixed'
         RETURNING block_id`,
        newStatus,
        is_valid ? "new" : "not_an_issue",
        report_id,
      );

      let roadIssueId: string | null = null;
      let tenderGenerated = false;
      const blockId = report[0]?.block_id || null;

      if (is_valid) {
        const issue = await ensureRoadIssueForReport(report_id);
        roadIssueId = issue.issueId;
        if (blockId) {
          tenderGenerated = await checkAndGenerateTender(blockId);
          if (tenderGenerated || await hasOpenTender(blockId)) {
            await pushBlockToTenderWebsite(blockId, "webhook:ml-validation").catch(() => undefined);
          }
        }
      }

      res.json({
        success: true,
        road_issue_id: roadIssueId,
        tender_generated: tenderGenerated,
        block_id: blockId,
      });
    } catch (err) {
      logger.error({ err }, "ML webhook error");
      return res.status(500).json({ error: "Failed to process ML validation" });
    }
  },
);

export default router;
