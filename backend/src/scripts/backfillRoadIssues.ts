import dotenv from "dotenv";
dotenv.config();

import prisma from "../config/database";
import logger from "../config/logger";

/**
 * One-off backfill for the public map layer.
 *
 * Older reports were stored only in `potholes`; the public map now reads
 * `road_issues`. This clusters verified/fixed reports within the configured
 * radius into one issue and links each report as evidence.
 *
 * Usage:
 *   npm run backfill:road-issues
 *   npm run backfill:road-issues -- --dry-run
 */
const RADIUS = Math.min(Math.max(Number(process.env.ROAD_ISSUE_DEDUP_RADIUS_METERS || 15), 1), 50);
const DRY_RUN = process.argv.includes("--dry-run");

interface ReportRow {
  id: string;
  latitude: number;
  longitude: number;
  block_id: string | null;
  status: string;
  condition: string | null;
  severity_score: string | null;
  pothole_count: number | null;
  confidence: string | null;
  model_version: string | null;
  analysis: unknown;
}

async function main() {
  const reports = await prisma.$queryRawUnsafe<ReportRow[]>(
    `SELECT
       id,
       ST_Y(location::geometry) AS latitude,
       ST_X(location::geometry) AS longitude,
       block_id,
       status,
       NULLIF(ai_result->>'condition', '') AS condition,
       ai_result->>'severityScore' AS severity_score,
       NULLIF(ai_result->>'potholeCount', '')::int AS pothole_count,
       ai_result->>'confidence' AS confidence,
       ai_result->>'modelVersion' AS model_version,
       ai_result AS analysis
     FROM potholes
     WHERE canonical_issue_id IS NULL
       AND status IN ('verified', 'fixed')
     ORDER BY created_at ASC`,
  );

  console.log(`Found ${reports.length} unlinked verified/fixed reports (radius ${RADIUS}m)${DRY_RUN ? " [dry run]" : ""}`);
  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const report of reports) {
    const condition = report.condition || "pothole";
    const issueStatus = report.status === "fixed" ? "fixed" : "active";
    const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id
       FROM road_issues
       WHERE status = $1::"RoadIssueStatus"
         AND condition = $2
         AND block_id IS NOT DISTINCT FROM $3
         AND ST_DWithin(
           location::geography,
           ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
           $6
         )
       ORDER BY ST_Distance(
         location::geography,
         ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography
       )
       LIMIT 1`,
      issueStatus,
      condition,
      report.block_id,
      Number(report.longitude),
      Number(report.latitude),
      RADIUS,
    );

    if (existing[0]) {
      linked++;
      if (!DRY_RUN) {
        await prisma.$transaction([
          prisma.$executeRawUnsafe(
            `UPDATE potholes
             SET canonical_issue_id = $1::uuid, deduplication_state = 'reused'
             WHERE id = $2::uuid`,
            existing[0].id,
            report.id,
          ),
          prisma.$executeRawUnsafe(
            `UPDATE road_issues
             SET evidence_count = evidence_count + 1,
                 last_detected_at = GREATEST(last_detected_at, NOW()),
                 block_id = COALESCE(block_id, $2)
             WHERE id = $1::uuid`,
            existing[0].id,
            report.block_id,
          ),
        ]);
      }
      continue;
    }

    created++;
    if (DRY_RUN) continue;

    const issue = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO road_issues (
         condition, location, block_id, severity_score, pothole_count, confidence,
         status, model_version, analysis
       ) VALUES (
         $1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7, $8::"RoadIssueStatus", $9, $10::jsonb
       ) RETURNING id`,
      condition,
      Number(report.longitude),
      Number(report.latitude),
      report.block_id,
      report.severity_score === null ? null : Number(report.severity_score),
      report.pothole_count === null ? 1 : Number(report.pothole_count),
      report.confidence === null ? null : Number(report.confidence),
      issueStatus,
      report.model_version,
      report.analysis ? JSON.stringify(report.analysis) : null,
    );
    const issueId = issue[0]?.id;
    if (!issueId) {
      skipped++;
      continue;
    }
    await prisma.$executeRawUnsafe(
      `UPDATE potholes SET canonical_issue_id = $1::uuid WHERE id = $2::uuid`,
      issueId,
      report.id,
    );
  }

  console.log(
    `${DRY_RUN ? "Would create" : "Created"} ${created} issues, ` +
      `${DRY_RUN ? "would link" : "linked"} ${linked} reports, skipped ${skipped}.`,
  );
}

main()
  .catch((err) => {
    logger.error({ err }, "Road issue backfill failed");
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
