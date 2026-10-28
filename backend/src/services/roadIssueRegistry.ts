import prisma from "../config/database";
import logger from "../config/logger";

export type RoadCondition = "pothole" | "crack" | "unpaved_or_heavy_damage";

export interface AiRoadAnalysis {
  condition: RoadCondition;
  severityScore: number;
  potholeCount: number;
  confidence: number;
  modelVersion?: string;
  details?: Record<string, unknown>;
}

interface IssueRow {
  id: string;
}

interface ReportRow {
  latitude: number;
  longitude: number;
  block_id: string | null;
  canonical_issue_id: string | null;
}

function deduplicationRadiusMeters() {
  const configured = Number(process.env.ROAD_ISSUE_DEDUP_RADIUS_METERS || 15);
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 1), 50) : 15;
}

async function getReport(reportId: string): Promise<ReportRow | null> {
  const rows = await prisma.$queryRawUnsafe<ReportRow[]>(
    `SELECT
       ST_Y(location::geometry) AS latitude,
       ST_X(location::geometry) AS longitude,
       block_id,
       canonical_issue_id
     FROM potholes
     WHERE id = $1::uuid`,
    reportId,
  );
  return rows[0] || null;
}

async function findNearbyIssue(
  latitude: number,
  longitude: number,
  condition: string,
): Promise<IssueRow | null> {
  const rows = await prisma.$queryRawUnsafe<IssueRow[]>(
    `SELECT id
       FROM road_issues
      WHERE status = 'active'
        AND condition = $1
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          $4
        )
      ORDER BY ST_Distance(
        location::geography,
        ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
      )
      LIMIT 1`,
    condition,
    longitude,
    latitude,
    deduplicationRadiusMeters(),
  );
  return rows[0] || null;
}

async function attachReportToIssue(
  reportId: string,
  issueId: string,
  blockId: string | null,
  aiResult: string | null,
) {
  await prisma.$transaction([
    prisma.$executeRawUnsafe(
      `UPDATE road_issues
          SET evidence_count = evidence_count + 1,
              last_detected_at = NOW(),
              block_id = COALESCE(block_id, $1)
        WHERE id = $2::uuid`,
      blockId,
      issueId,
    ),
    prisma.$executeRawUnsafe(
      `UPDATE potholes
          SET status = 'verified',
              canonical_issue_id = $1::uuid,
              deduplication_state = 'reused',
              block_id = COALESCE(block_id, $2),
              ai_result = COALESCE($3::jsonb, ai_result)
        WHERE id = $4::uuid`,
      issueId,
      blockId,
      aiResult,
      reportId,
    ),
  ]);
}

/**
 * Record an AI result for a report.
 *
 * Proximity + condition is authoritative for "one physical marker". Image
 * matching is deliberately not allowed to create a second issue at the same
 * spot; that produced multiple pins for one pothole when two citizens uploaded
 * different photos.
 */
export async function recordAiRoadAnalysis(reportId: string, analysis: AiRoadAnalysis) {
  const report = await getReport(reportId);
  if (!report) throw new Error("Report not found");
  if (report.canonical_issue_id) {
    // Replayed webhook: do not double-count evidence.
    return { issueId: report.canonical_issue_id, reused: true };
  }

  const aiResult = JSON.stringify(analysis);

  if (analysis.potholeCount < 1) {
    await prisma.$executeRawUnsafe(
      `UPDATE potholes
          SET status = 'rejected',
              deduplication_state = 'not_an_issue',
              ai_result = $1::jsonb
        WHERE id = $2::uuid`,
      aiResult,
      reportId,
    );
    return { issueId: null, reused: false };
  }

  const existing = await findNearbyIssue(
    Number(report.latitude),
    Number(report.longitude),
    analysis.condition,
  );

  if (existing) {
    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        `UPDATE road_issues
            SET severity_score = GREATEST(COALESCE(severity_score, 0), $1),
                pothole_count = GREATEST(pothole_count, $2),
                confidence = GREATEST(COALESCE(confidence, 0), $3),
                model_version = COALESCE($4, model_version),
                analysis = $5::jsonb,
                block_id = COALESCE(block_id, $6)
          WHERE id = $7::uuid`,
        analysis.severityScore,
        analysis.potholeCount,
        analysis.confidence,
        analysis.modelVersion || null,
        aiResult,
        report.block_id,
        existing.id,
      ),
      prisma.$executeRawUnsafe(
        `UPDATE potholes
            SET status = 'verified',
                canonical_issue_id = $1::uuid,
                deduplication_state = 'reused',
                block_id = COALESCE(block_id, $2),
                ai_result = $3::jsonb
          WHERE id = $4::uuid`,
        existing.id,
        report.block_id,
        aiResult,
        reportId,
      ),
      prisma.$executeRawUnsafe(
        `UPDATE road_issues SET evidence_count = evidence_count + 1, last_detected_at = NOW() WHERE id = $1::uuid`,
        existing.id,
      ),
    ]);
    logger.info({ reportId, issueId: existing.id }, "Report attached to existing road issue");
    return { issueId: existing.id, reused: true };
  }

  const created = await prisma.$queryRawUnsafe<IssueRow[]>(
    `INSERT INTO road_issues (
       condition, location, block_id, severity_score, pothole_count, confidence,
       model_version, analysis
     ) VALUES (
       $1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7, $8, $9::jsonb
     ) RETURNING id`,
    analysis.condition,
    Number(report.longitude),
    Number(report.latitude),
    report.block_id,
    analysis.severityScore,
    analysis.potholeCount,
    analysis.confidence,
    analysis.modelVersion || null,
    aiResult,
  );
  const issue = created[0];
  await prisma.$executeRawUnsafe(
    `UPDATE potholes
        SET status = 'verified',
            canonical_issue_id = $1::uuid,
            block_id = COALESCE(block_id, $2),
            ai_result = $3::jsonb
      WHERE id = $4::uuid`,
    issue.id,
    report.block_id,
    aiResult,
    reportId,
  );
  return { issueId: issue.id, reused: false };
}

/**
 * Create or attach a road issue when an admin manually verifies a report that
 * the AI worker never scored (for example during an AI outage).
 */
export async function ensureRoadIssueForReport(reportId: string) {
  const report = await getReport(reportId);
  if (!report) throw new Error("Report not found");
  if (report.canonical_issue_id) return { issueId: report.canonical_issue_id, reused: true };

  const existing = await findNearbyIssue(Number(report.latitude), Number(report.longitude), "pothole");
  if (existing) {
    await attachReportToIssue(reportId, existing.id, report.block_id, null);
    return { issueId: existing.id, reused: true };
  }

  const created = await prisma.$queryRawUnsafe<IssueRow[]>(
    `INSERT INTO road_issues (condition, location, block_id, pothole_count)
     VALUES ('pothole', ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, 1)
     RETURNING id`,
    Number(report.longitude),
    Number(report.latitude),
    report.block_id,
  );
  const issue = created[0];
  await prisma.$executeRawUnsafe(
    `UPDATE potholes
        SET status = 'verified',
            canonical_issue_id = $1::uuid,
            block_id = COALESCE(block_id, $2)
      WHERE id = $3::uuid`,
    issue.id,
    report.block_id,
    reportId,
  );
  return { issueId: issue.id, reused: false };
}

/** Backwards-compatible helper used by older callers. */
export async function attachToNearbyRoadIssue(input: {
  reportId: string;
  latitude: number;
  longitude: number;
}) {
  return ensureRoadIssueForReport(input.reportId);
}
