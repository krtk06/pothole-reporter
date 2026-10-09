/**
 * Deployment verification.
 *
 * Answers one question: is the live EC2 deployment actually in the state the
 * code in this repository describes? Every check prints PASS / FAIL / WARN and
 * the script exits non-zero if anything FAILs, so it is usable as a CI gate or
 * a post-deploy smoke test.
 *
 *   npm run verify:deploy
 *   npm run verify:deploy -- --strict   # WARN also fails
 *
 * This replaces eyeballing `/api/health`, which only proves the process is
 * alive.
 */

import prisma from "../config/database";
import logger from "../config/logger";

type Status = "PASS" | "FAIL" | "WARN";
interface Result {
  status: Status;
  name: string;
  detail: string;
}

const results: Result[] = [];
const STRICT = process.argv.includes("--strict");

function record(status: Status, name: string, detail: string) {
  results.push({ status, name, detail });
  // Written to stdout, not the pino logger, so the report is readable.
  const mark = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "!";
  console.log(`  ${mark} [${status}] ${name}\n      ${detail}`);
}

async function scalar<T = any>(sql: string, ...params: any[]): Promise<T> {
  const rows: any[] = await prisma.$queryRawUnsafe(sql, ...params);
  return rows?.[0] as T;
}

// ── 1. Where are we actually talking to? ──────────────────────────────────────
async function checkTarget() {
  const url = process.env.DATABASE_URL || "";
  let host = "unknown";
  try {
    host = new URL(url).hostname;
  } catch {
    /* keep unknown */
  }
  const looksSupabase = /supabase\.(co|com)/i.test(host);
  const looksRds = /\.rds\.amazonaws\.com$/i.test(host) || /\.rds\./.test(host);

  if (!url) {
    record("FAIL", "DATABASE_URL is set", "DATABASE_URL is empty — the app cannot reach a database");
  } else if (looksSupabase) {
    record("WARN", "database host", `${host} — Supabase pooler, not RDS. Confirm this is the intended target.`);
  } else if (looksRds) {
    record("PASS", "database host", `${host} (RDS)`);
  } else {
    record("WARN", "database host", `${host} — neither Supabase nor an RDS endpoint; confirm this is intended`);
  }
}

// ── 2. Did the migrations actually apply? ────────────────────────────────────
async function checkMigrations() {
  try {
    const pending = await scalar<{ n: string }>(
      `SELECT count(*)::text AS n FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
    );
    if (Number(pending.n) === 0) {
      record("PASS", "migrations applied", "no migration is stuck mid-flight");
    } else {
      record("FAIL", "migrations applied", `${pending.n} migration(s) recorded but not finished`);
    }
  } catch (err: any) {
    record("WARN", "migrations applied", `could not read _prisma_migrations: ${err?.message}`);
  }
}

/**
 * The guard for the tender duplicate race. Without it, two admins verifying
 * the last potholes of a block concurrently create two tenders.
 */
async function checkUniqueIndex() {
  const row = await scalar<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM pg_indexes
      WHERE tablename = 'tenders'
        AND indexname = 'tenders_block_id_open_assigned_key'`,
  );
  if (Number(row.n) === 1) {
    record("PASS", "tender duplicate guard", "partial unique index present on tenders(block_id)");
  } else {
    record(
      "FAIL",
      "tender duplicate guard",
      "index tenders_block_id_open_assigned_key is MISSING — run: npm run prisma:migrate",
    );
  }
}

/** tender_sync_* were historically created at runtime only, never by a migration. */
async function checkSyncTables() {
  const row = await scalar<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND tablename IN ('tender_sync_settings', 'tender_sync_logs')`,
  );
  if (Number(row.n) === 2) {
    record("PASS", "tender sync tables", "tender_sync_settings and tender_sync_logs both exist");
  } else {
    record("FAIL", "tender sync tables", `only ${row.n}/2 tender_sync tables exist`);
  }
}

// ── 3. Do the core tables still exist? ───────────────────────────────────────
// potholes and administrative_areas are deliberately absent from schema.prisma,
// so `prisma db push` / `migrate dev` would DROP them. This is the single most
// destructive thing that can happen to this deployment, hence an explicit check.
async function checkCoreTables() {
  const row = await scalar<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND tablename IN ('potholes', 'administrative_areas', 'users', 'tenders')`,
  );
  if (Number(row.n) === 4) {
    const reports = await scalar<{ n: string }>(`SELECT count(*)::text AS n FROM potholes`);
    record("PASS", "core tables intact", `potholes, administrative_areas, users, tenders all present (${reports.n} reports)`);
  } else {
    record("FAIL", "core tables intact", `only ${row.n}/4 core tables exist — a destructive prisma command may have run`);
  }
}

// ── 4. Is the coordinate backfill done? ──────────────────────────────────────
// services/geoService.ts resolves block_id by nearest-neighbour against these
// coordinates. If they are NULL, every NEW mobile report gets no block_id.
async function checkAreaCoordinates() {
  const row = await scalar<{ total: string; with_coords: string }>(
    `SELECT count(*)::text AS total, count(latitude)::text AS with_coords
       FROM administrative_areas
      WHERE level IN ('subdistrict', 'district', 'state')`,
  );
  const total = Number(row.total);
  const withCoords = Number(row.with_coords);

  if (total === 0) {
    record("FAIL", "area coordinates", "administrative_areas has no rows at all");
  } else if (withCoords === 0) {
    record(
      "FAIL",
      "area coordinates",
      `0 of ${total} areas have coordinates — block_id resolution cannot work. Run: npm run backfill:areas -- --level=subdistrict`,
    );
  } else if (withCoords < total) {
    record("WARN", "area coordinates", `${withCoords}/${total} areas have coordinates (partial)`);
  } else {
    record("PASS", "area coordinates", `${withCoords}/${total} areas geocoded`);
  }
}

// ── 5. Do the backfilled block_ids match real admin jurisdictions? ───────────
// The silent-failure mode: block_ids exist but were built from a different
// naming source than the seeded admins, so every scoped query returns nothing
// and the tenders are invisible.
async function checkScopeMatch() {
  const row = await scalar<{ n: string; total: string }>(
    `SELECT count(DISTINCT p.id)::text AS n, count(DISTINCT u.id)::text AS total
       FROM users u
       JOIN potholes p
         ON p.block_id = lower(u.state) || '/' || lower(u.district)
         OR p.block_id LIKE lower(u.state) || '/' || lower(u.district) || '/%'
      WHERE u.role = 'admin' AND u.admin_scope = 'district'`,
  );

  const totalAdmins = Number(row.total);
  const visible = Number(row.n);

  if (totalAdmins === 0) {
    record("WARN", "block_id ↔ admin scope", "no district admins found to test against");
    return;
  }
  if (visible === 0) {
    record(
      "FAIL",
      "block_id ↔ admin scope",
      "0 reports visible to any district admin — block_ids do not match admin jurisdictions. Either the backfill used different place names, or block_id is NULL",
    );
  } else {
    record("PASS", "block_id ↔ admin scope", `${visible} reports visible across ${totalAdmins} district admins`);
  }
}

async function checkOrphanReports() {
  const row = await scalar<{ n: string }>(`SELECT count(*)::text AS n FROM potholes WHERE block_id IS NULL`);
  const n = Number(row.n);
  if (n === 0) {
    record("PASS", "reports without block_id", "none");
  } else {
    record(
      "WARN",
      "reports without block_id",
      `${n} report(s) have no block_id — they are invisible to scoped admin queries and can never reach the tender threshold`,
    );
  }
}

/** block_id must be lowercase to match the lowercased admin scope prefixes. */
async function checkBlockIdFormat() {
  const row = await scalar<{ n: string }>(
    `SELECT count(*)::text AS n FROM potholes
      WHERE block_id IS NOT NULL AND block_id <> lower(block_id)`,
  );
  if (Number(row.n) === 0) {
    record("PASS", "block_id casing", "all block_ids are lowercase, matching admin scope prefixes");
  } else {
    record("FAIL", "block_id casing", `${row.n} block_id(s) are not lowercase and will never match a scope prefix`);
  }
}

// ── 6. Tender state ──────────────────────────────────────────────────────────
async function checkDuplicates() {
  const row = await scalar<{ n: string }>(
    `SELECT count(*)::text AS n FROM (
       SELECT block_id FROM tenders
        WHERE status IN ('open','assigned')
        GROUP BY block_id HAVING count(*) > 1
     ) d`,
  );
  if (Number(row.n) === 0) {
    record("PASS", "no duplicate tenders", "one open/assigned tender per block");
  } else {
    record("WARN", "no duplicate tenders", `${row.n} block(s) have more than one open tender — the unique index is missing or predates it`);
  }
}

async function checkTenderEconomics() {
  // The pipeline prices at 150 per verified pothole. If backfilled tenders do
  // not match, they came from a different code path and the public budget is wrong.
  const row = await scalar<{ n: string; bad: string }>(
    `SELECT count(*)::text AS n,
            count(*) FILTER (WHERE abs(estimated_cost - pothole_count * 150.0) > 0.01)::text AS bad
       FROM tenders`,
  );
  const total = Number(row.n);
  const bad = Number(row.bad);
  if (total === 0) {
    record("WARN", "tender pricing", "no tenders exist yet");
  } else if (bad === 0) {
    record("PASS", "tender pricing", `${total} tender(s) all priced at pothole_count x 150`);
  } else {
    record(
      "WARN",
      "tender pricing",
      `${bad}/${total} tenders are not priced at pothole_count x 150 — they were created outside checkAndGenerateTender`,
    );
  }
}

/** A tender whose threshold was met should have pushed to the portal. */
async function checkSyncHealth() {
  const row = await scalar<{ status: string | null; at: string | null; msg: string | null }>(
    `SELECT last_sync_status AS status, last_sync_at::text AS at, last_sync_message AS msg
       FROM tender_sync_settings WHERE id = 'default'`,
  );
  if (!row) {
    record("FAIL", "tender sync settings", "no settings row — the portal will never receive data");
  } else if (row.status === "success") {
    record("PASS", "tender sync", `last sync succeeded at ${row.at}`);
  } else if (row.status === "failed") {
    record("FAIL", "tender sync", `last sync FAILED at ${row.at}: ${row.msg ?? "no message"}`);
  } else {
    record("WARN", "tender sync", `last sync status is "${row.status}" at ${row.at ?? "never"}`);
  }
}

/**
 * A tender's stored pothole_count must equal the number of VERIFIED potholes
 * actually in that block.
 *
 * This is the check that catches seeded/fabricated tender rows. A pricing
 * check is not enough: a fabricated row can be perfectly self-consistent
 * (pothole_count 3 at 3 x 150 = 450) and pass every arithmetic assertion while
 * describing a block that holds a completely different number of verified
 * reports. Only comparing against the source rows distinguishes real from
 * invented.
 */
async function checkTenderIntegrity() {
  const row = await scalar<{ n: string; mismatched: string; samples: string }>(
    `SELECT count(*)::text AS n,
            count(*) FILTER (WHERE t.pothole_count <> a.actual)::text AS mismatched,
            coalesce(string_agg(t.block_id || ' says ' || t.pothole_count || ', actually ' || a.actual, '; '), '') AS samples
       FROM tenders t
       LEFT JOIN LATERAL (
         SELECT count(*) AS actual FROM potholes p
          WHERE p.block_id = t.block_id AND p.status = 'verified'
       ) a ON true
      WHERE t.status IN ('open','assigned')`,
  );

  const total = Number(row.n);
  const mismatched = Number(row.mismatched);

  if (total === 0) {
    record("WARN", "tender count integrity", "no open/assigned tenders to check");
  } else if (mismatched === 0) {
    record("PASS", "tender count integrity", `${total} tender(s) match their verified pothole count`);
  } else {
    record(
      "FAIL",
      "tender count integrity",
      `${mismatched}/${total} tender(s) claim a pothole_count that does not match the verified reports in their block — these rows are seeded, not generated. ${row.samples.slice(0, 220)}`,
    );
  }
}

/** Tenders should also have been created by the threshold pipeline, not by a script. */
async function checkDemoSeeding() {
  const row = await scalar<{ n: string }>(
    `SELECT count(*)::text AS n FROM tenders
      WHERE estimated_cost = pothole_count * 150.0
        AND pothole_count <= 5
        AND status = 'open'`,
  );
  if (Number(row.n) > 0) {
    record(
      "WARN",
      "possible demo-seeded tenders",
      `${row.n} tender(s) have a suspiciously small round-number pothole_count priced at 150 each — consistent with a hand-written seeding script rather than the threshold pipeline`,
    );
  } else {
    record("PASS", "possible demo-seeded tenders", "no round-number tenders found");
  }
}

async function main() {
  console.log("\n=== Deployment verification ===\n");

  // Fail fast and loudly on an unreachable database rather than running every
  // check and printing twelve identical Prisma connection errors.
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
  } catch (err: any) {
    console.log("  ✗ [FAIL] database reachable");
    console.log(`      ${err?.message?.split("\n").filter(Boolean).slice(0, 3).join(" ")}`);
    console.log(
      `\n  Cannot reach the database. Check DATABASE_URL in the deployed .env,\n` +
        `  and that the host is reachable from this machine.\n`,
    );
    process.exitCode = 1;
    return;
  }
  console.log("  ✓ database reachable\n");

  const checks: Array<[string, () => Promise<void>]> = [
    ["target", checkTarget],
    ["migrations", checkMigrations],
    ["unique index", checkUniqueIndex],
    ["sync tables", checkSyncTables],
    ["core tables", checkCoreTables],
    ["area coords", checkAreaCoordinates],
    ["scope match", checkScopeMatch],
    ["block casing", checkBlockIdFormat],
    ["orphans", checkOrphanReports],
    ["duplicates", checkDuplicates],
    ["pricing", checkTenderEconomics],
    ["tender integrity", checkTenderIntegrity],
    ["demo seeding", checkDemoSeeding],
    ["sync health", checkSyncHealth],
  ];

  for (const [name, fn] of checks) {
    try {
      await fn();
    } catch (err: any) {
      record("FAIL", name, `check threw: ${err?.message}`);
    }
  }

  const failed = results.filter((r) => r.status === "FAIL");
  const warned = results.filter((r) => r.status === "WARN");

  console.log(`\n=== ${results.length} checks: ${results.length - failed.length - warned.length} passed, ${warned.length} warnings, ${failed.length} failed ===\n`);

  if (failed.length > 0) {
    console.log("FAILED:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    console.log("");
  }
  process.exitCode = failed.length > 0 || (STRICT && warned.length > 0) ? 1 : 0;
}

main()
  .catch((err) => {
    logger.error({ err }, "verification failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
