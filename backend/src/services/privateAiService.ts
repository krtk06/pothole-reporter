import fs from "fs/promises";
import path from "path";
import prisma from "../config/database";
import logger from "../config/logger";
import { recordAiRoadAnalysis, RoadCondition } from "./roadIssueRegistry";

function aiBaseUrl(): string {
  const configured = (process.env.AI_SERVICE_URL || "").trim().replace(/\/+$/, "");
  if (!configured) throw new Error("AI_SERVICE_URL is not configured");
  return configured;
}

function chooseCondition(summary: any): RoadCondition {
  if (Number(summary.pothole_count) > 0) return "pothole";
  if (Number(summary.crack_count) > 0) return "crack";
  return "unpaved_or_heavy_damage";
}

export async function analyzeEvidenceWithPrivateAi(input: {
  reportId: string;
  filePath: string;
  mediaType: string;
  mode: "single" | "road";
  latitude: number;
  longitude: number;
}): Promise<void> {
  try {
    const bytes = await fs.readFile(input.filePath);
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: input.mediaType }), path.basename(input.filePath));
    form.append("latitude", String(input.latitude));
    form.append("longitude", String(input.longitude));
    if (input.mode === "road") form.append("include_frame_results", "false");

    const endpoint = input.mode === "road" ? "detect/video" : "detect/image";
    const headers: Record<string, string> = {};
    if (process.env.AI_SERVER_API_KEY) headers["X-API-Key"] = process.env.AI_SERVER_API_KEY;

    const response = await fetch(`${aiBaseUrl()}/${endpoint}`, {
      method: "POST",
      headers,
      body: form,
      signal: AbortSignal.timeout(Number(process.env.AI_REQUEST_TIMEOUT_MS || 180000)),
    });
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      throw new Error(result.error || result.detail || `AI service returned ${response.status}`);
    }

    const summary = result.summary || {};
    const total =
      Number(summary.pothole_count || 0) +
      Number(summary.crack_count || 0) +
      Number(summary.unpaved_or_heavy_damage_count || 0);

    await recordAiRoadAnalysis(input.reportId, {
      condition: chooseCondition(summary),
      severityScore: Number(summary.severity_score || 0),
      potholeCount: total,
      confidence:
        result.detections?.reduce(
          (best: number, item: any) => Math.max(best, Number(item.confidence || 0)),
          0,
        ) || 0,
      modelVersion: result.model?.name,
      details: result,
    });

    logger.info({ reportId: input.reportId, endpoint, total }, "Private AI evidence analysis completed");
  } catch (err) {
    // Leaving the report pending is the required fallback: a Mandal officer can
    // still verify it manually. The upload itself must not fail.
    await prisma
      .$executeRawUnsafe(
        `UPDATE potholes SET ai_result = $1::jsonb WHERE id = $2::uuid`,
        JSON.stringify({ status: "failed", error: err instanceof Error ? err.message : "AI request failed" }),
        input.reportId,
      )
      .catch(() => undefined);
    logger.error({ err, reportId: input.reportId }, "Private AI evidence analysis failed; report remains pending");
  }
}
