import dotenv from "dotenv";
dotenv.config();

import { classifyDatabaseUrl } from "../config/databaseTarget";

type Level = "PASS" | "WARN" | "FAIL";
const results: Array<{ level: Level; name: string; detail: string }> = [];

function record(level: Level, name: string, detail: string) {
  results.push({ level, name, detail });
}

async function main() {
  const target = classifyDatabaseUrl(process.env.DATABASE_URL);
  if (!target.ok) {
    console.error(`\nFAIL  database target: ${target.reason}${target.host ? ` (${target.host})` : ""}`);
    console.error("This backend is AWS RDS-only. No connection was opened.\n");
    process.exitCode = 1;
    return;
  }
  record("PASS", "database target", target.reason);

  for (const key of ["JWT_SECRET", "JWT_REFRESH_SECRET", "JWT_RESET_SECRET"]) {
    record(process.env[key] ? "PASS" : "FAIL", `env ${key}`, process.env[key] ? "set" : "missing");
  }

  const { default: prisma } = await import("../config/database");
  try {
    const scalar = async <T>(sql: string, ...params: any[]): Promise<T> => {
      const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
      return rows[0] as T;
    };

    const migration = await scalar<{ count: bigint }>(
      `SELECT COUNT(*)::bigint AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
    ).catch(() => null);
    record(migration ? "PASS" : "WARN", "migration history", migration ? `${migration.count} applied` : "_prisma_migrations not found");

    const columns = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (table_name, column_name) IN (
           ('users','admin_scope'), ('users','locality'),
           ('user_sessions','refresh_token_hash'),
           ('road_issues','block_id'),
           ('administrative_areas','bbox'),
           ('tender_sync_settings','sync_lock_until')
         )`,
    );
    const columnSet = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
    for (const expected of [
      "users.admin_scope",
      "users.locality",
      "user_sessions.refresh_token_hash",
      "road_issues.block_id",
      "administrative_areas.bbox",
      "tender_sync_settings.sync_lock_until",
    ]) {
      record(columnSet.has(expected) ? "PASS" : "FAIL", `column ${expected}`, columnSet.has(expected) ? "present" : "missing");
    }

    const rejected = await scalar<{ count: bigint }>(
      `SELECT COUNT(*)::bigint AS count FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'TenderStatus' AND e.enumlabel = 'rejected'`,
    );
    record(Number(rejected.count) > 0 ? "PASS" : "FAIL", "TenderStatus.rejected", Number(rejected.count) > 0 ? "present" : "missing");

    const index = await scalar<{ count: bigint }>(
      `SELECT COUNT(*)::bigint AS count FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'tenders_block_id_open_assigned_key'`,
    );
    record(Number(index.count) > 0 ? "PASS" : "WARN", "partial tender index", Number(index.count) > 0 ? "present" : "missing; resolve duplicate open tenders first");

    const admins = await scalar<{ total: bigint; scoped: bigint; bad: bigint }>(
      `SELECT COUNT(*)::bigint AS total,
              COUNT(admin_scope)::bigint AS scoped,
              COUNT(*) FILTER (WHERE role = 'admin' AND admin_scope IS NULL)::bigint AS bad
       FROM users`,
    );
    record(Number(admins.total) > 0 ? "PASS" : "FAIL", "users", `${admins.total} total, ${admins.scoped} with admin_scope`);
    record(Number(admins.bad) === 0 ? "PASS" : "FAIL", "admin jurisdiction", `${admins.bad} admin(s) without a resolved scope`);

    const areas = await scalar<{ total: bigint; with_coords: bigint }>(
      `SELECT COUNT(*)::bigint AS total, COUNT(latitude)::bigint AS with_coords FROM administrative_areas`,
    );
    record(
      Number(areas.total) === 0 ? "FAIL" : Number(areas.with_coords) === 0 ? "FAIL" : Number(areas.with_coords) < Number(areas.total) ? "WARN" : "PASS",
      "area coordinates",
      `${areas.with_coords}/${areas.total} areas geocoded`,
    );

    const reports = await scalar<{ total: bigint; with_block: bigint }>(
      `SELECT COUNT(*)::bigint AS total, COUNT(block_id)::bigint AS with_block FROM potholes`,
    );
    record(
      Number(reports.total) === 0
        ? "WARN"
        : Number(reports.with_block) === 0
          ? "FAIL"
          : Number(reports.with_block) < Number(reports.total)
            ? "WARN"
            : "PASS",
      "report jurisdiction",
      `${reports.with_block}/${reports.total} reports have block_id`,
    );

    const issues = await scalar<{ count: bigint }>(`SELECT COUNT(*)::bigint AS count FROM road_issues`);
    record(Number(issues.count) > 0 ? "PASS" : "WARN", "road issues", `${issues.count} rows`);

    const duplicates = await scalar<{ count: bigint }>(
      `SELECT COUNT(*)::bigint AS count FROM (
         SELECT block_id FROM tenders WHERE status IN ('open','assigned')
         GROUP BY block_id HAVING COUNT(*) > 1
       ) dupes`,
    );
    record(Number(duplicates.count) === 0 ? "PASS" : "FAIL", "open tender duplicates", `${duplicates.count} block(s) with duplicates`);

    const settings = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, target_url, api_key, sync_interval_days FROM tender_sync_settings WHERE id = 'default'`,
    );
    const settingsRow = settings[0];
    record(settingsRow ? "PASS" : "FAIL", "tender sync settings", settingsRow ? `interval ${settingsRow.sync_interval_days}d` : "missing default row");
    if (settingsRow) {
      record(settingsRow.target_url ? "PASS" : "WARN", "tender target URL", settingsRow.target_url || "empty");
      record(settingsRow.api_key ? "PASS" : "WARN", "tender API key", settingsRow.api_key ? "configured" : "empty");
    }

    const adminEmail = process.env.CHECK_ADMIN_EMAIL;
    const legacyPassword = process.env.LEGACY_DEFAULT_ADMIN_PASSWORD;
    if (adminEmail && legacyPassword) {
      const row = await scalar<{ password_hash: string }>(
        `SELECT password_hash FROM users WHERE email = $1 LIMIT 1`,
        adminEmail,
      ).catch(() => null);
      if (row) {
        const bcrypt = await import("bcryptjs");
        const matches = await bcrypt.compare(legacyPassword, row.password_hash);
        record(matches ? "FAIL" : "PASS", "legacy admin password", matches ? "known default password still works — rotate immediately" : "not the known default");
      }
    } else {
      record("WARN", "legacy admin password", "set CHECK_ADMIN_EMAIL and LEGACY_DEFAULT_ADMIN_PASSWORD to test the known default");
    }
  } catch (err: any) {
    record("FAIL", "database check", err?.message || "could not query the database");
  } finally {
    await prisma.$disconnect();
  }

  for (const result of results) console.log(`${result.level.padEnd(4)}  ${result.name}: ${result.detail}`);
  const failed = results.filter((result) => result.level === "FAIL");
  console.log(`\n${failed.length === 0 ? "Deployment verification passed." : `${failed.length} check(s) failed.`}\n`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
