import dotenv from "dotenv";
dotenv.config();

import prisma from "../config/database";
import logger from "../config/logger";
import { resolveBlockIdFromCoordinates } from "../services/geoService";

/**
 * One-off repair for reports created before the administrative-area directory
 * was populated. It resolves each report's block_id from its GPS point and
 * leaves it untouched when no nearby area exists.
 *
 * Usage:
 *   npm run backfill:report-blocks
 */
async function main() {
  const reports = await prisma.$queryRawUnsafe<Array<{ id: string; latitude: number; longitude: number }>>(
    `SELECT id, ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude
     FROM potholes
     WHERE block_id IS NULL
     ORDER BY created_at ASC`,
  );

  console.log(`Found ${reports.length} reports without block_id`);
  let resolved = 0;

  for (const report of reports) {
    const blockId = await resolveBlockIdFromCoordinates(
      Number(report.latitude),
      Number(report.longitude),
    );
    if (!blockId) continue;
    await prisma.$executeRawUnsafe(
      `UPDATE potholes SET block_id = $1 WHERE id = $2::uuid`,
      blockId,
      report.id,
    );
    resolved += 1;
  }

  console.log(`Resolved ${resolved}/${reports.length} reports`);
}

main()
  .catch((err) => {
    logger.error({ err }, "Report block backfill failed");
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
