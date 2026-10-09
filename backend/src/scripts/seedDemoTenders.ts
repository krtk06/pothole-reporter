/**
 * Demo tender seeding — HONEST version.
 *
 * Replaces src/scripts/backfillPotholeBlocks.ts, which assigned block_ids by
 * ROW INDEX (`i === 1` -> kakinada, `i === 2` -> addateegala, everything else
 * -> eluru) over an unordered `SELECT id, status FROM potholes`, then inserted
 * tenders with a hardcoded pothole_count: 3 and estimated_cost: 450 for three
 * blocks regardless of what those blocks actually contained.
 *
 * That produced rows that were self-consistent and therefore invisible to any
 * arithmetic check, while describing a system state that did not exist. It also
 * did not populate administrative_areas, so no spatial lookup was ever
 * possible.
 *
 * This script never invents a location. It works from the block_ids that
 * genuinely exist on real rows, and it creates a tender through
 * checkAndGenerateTender so the count, the price and the duplicate guard all
 * come from the real pipeline.
 *
 * Usage:
 *   npm run seed:demo-tenders -- --dry-run     # report, change nothing
 *   npm run seed:demo-tenders                   # create tenders from real data
 *   npm run seed:demo-tenders -- --min-count=3  # lower the bar for a sparse demo
 *
 * If you need block_ids to be REAL, run the coordinate backfill first:
 *   npm run backfill:areas -- --level=subdistrict
 * That geocodes administrative_areas, after which POST /reports resolves a
 * genuine nearest-mandal block_id for every new mobile report.
 */

import prisma from "../config/database";
import logger from "../config/logger";
import { checkAndGenerateTender } from "../services/tenderService";

const DEFAULT_MIN_COUNT = 20; // matches POTHOLE_TENDER_THRESHOLD

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const minCount = Number(argValue("min-count") || DEFAULT_MIN_COUNT);

  // What the database actually says, per block. This is the only source of
  // truth used below.
  const blocks: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      block_id,
      count(*) FILTER (WHERE status = 'verified')::int AS verified,
      count(*)::int AS total
    FROM potholes
    WHERE block_id IS NOT NULL
    GROUP BY block_id
    ORDER BY block_id
  `);

  const orphans: any[] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM potholes WHERE block_id IS NULL`,
  );

  console.log(`\n=== Demo tender seeding${dryRun ? " (DRY RUN — nothing will be written)" : ""} ===\n`);
  console.log(`  reports with a block_id : ${blocks.reduce((s, b) => s + b.total, 0)}`);
  console.log(`  reports without one    : ${orphans[0]?.n ?? 0}`);
  console.log(`  blocks with >=1 report : ${blocks.length}\n`);

  if (blocks.length === 0) {
    console.log(
      "  No block_ids exist, so there is nothing honest to seed.\n" +
        "  Run the coordinate backfill first:\n" +
        "    npm run backfill:areas -- --level=subdistrict\n",
    );
    return;
  }

  const eligible = blocks.filter((b: any) => b.verified >= minCount);
  const belowThreshold = blocks.filter((b: any) => b.verified < minCount);

  console.log(`  Blocks at/over the threshold (${minCount} verified): ${eligible.length}`);
  for (const b of eligible) {
    console.log(`    ${b.block_id} — ${b.verified} verified`);
  }
  console.log(`\n  Blocks below the threshold: ${belowThreshold.length}`);
  for (const b of belowThreshold) {
    console.log(`    ${b.block_id} — ${b.verified} verified, ${b.total} total`);
  }

  if (eligible.length === 0) {
    console.log(
      `\n  Nothing qualifies. The data does not currently support a tender for any block.\n` +
        `  If this is a demo, either add more verified reports in a real block, or\n` +
        `  re-run with an explicit --min-count lower than the verified count above.\n` +
        `  Do NOT seed a tender with an invented count: the portal would then\n` +
        `  publish a budget that no report supports.\n`,
    );
  }

  if (dryRun) {
    console.log("\n  Dry run — no tenders created.\n");
    return;
  }

  let created = 0;
  for (const b of eligible) {
    // Goes through the real pipeline: counts verified potholes for the block,
    // prices at COST_PER_POTHOLE, respects the unique index, and dispatches to
    // the tender portal.
    const generated = await checkAndGenerateTender(b.block_id);
    if (generated) {
      created += 1;
      console.log(`  created tender for ${b.block_id}`);
    } else {
      console.log(`  tender already exists (or lost a race) for ${b.block_id}`);
    }
  }

  console.log(`\n  ${created} tender(s) created via checkAndGenerateTender.`);
  console.log(`  Run "npm run verify:deploy" to confirm the rows match their reports.\n`);
}

main()
  .catch((err) => {
    logger.error({ err }, "demo tender seeding failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
