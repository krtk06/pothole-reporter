import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Schema / migration-history consistency guard.
 *
 * The `potholes` and `administrative_areas` tables are intentionally NOT
 * modelled in schema.prisma — they are reached exclusively through raw SQL
 * because of their PostGIS geometry columns. That is a deliberate decision, but
 * it means a table can silently vanish from the schema without anything
 * failing: `prisma migrate deploy` would happily apply migrations for an
 * incomplete database.
 *
 * These tests read both files and assert they stay in agreement.
 *
 * Real drift detection (`prisma migrate diff`) needs a shadow database and
 * cannot run in CI here; this is the static substitute.
 */

// backend/src/__tests__ -> backend/
const BACKEND_ROOT = path.resolve(__dirname, "../..");
const SCHEMA = path.join(BACKEND_ROOT, "prisma/schema.prisma");
const MIGRATIONS_DIR = path.join(BACKEND_ROOT, "prisma/migrations");

/**
 * Tables present in the database (created by some migration) but deliberately
 * unmodelled because all access is raw SQL. Adding a table here means taking
 * responsibility for it — do it only alongside a comment in schema.prisma.
 */
const RAW_SQL_MANAGED = new Set(["potholes", "administrative_areas"]);

function readSchema(): string {
  return fs.readFileSync(SCHEMA, "utf-8");
}

/**
 * Strip comments before parsing. Without this the prose in the explanatory
 * comments above is indistinguishable from declarations — e.g. the sentence
 * "so a plain CREATE TABLE would abort the deploy" is read as a CREATE TABLE
 * for a table called "would", and a comment mentioning @@unique([block_id])
 * reads as a real unique constraint.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

function migrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(MIGRATIONS_DIR, d.name, "migration.sql"))
    .filter((f) => fs.existsSync(f));
}

/** Every table created by any migration, in file-name order. */
function tablesInHistory(): Set<string> {
  const tables = new Set<string>();
  for (const file of migrationFiles()) {
    const sql = stripComments(fs.readFileSync(file, "utf-8"));
    for (const m of sql.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_]+)"?\s*\(/gi,
    )) {
      tables.add(m[1]);
    }
  }
  return tables;
}

/** Every table the schema claims to own, via @@map("...") or a snake_case model name. */
function tablesInSchema(): Set<string> {
  const schema = stripComments(readSchema());
  const tables = new Set<string>();
  for (const m of schema.matchAll(/@@map\("([a-z_]+)"\)/g)) {
    tables.add(m[1]);
  }
  // snake_case model names (no @@map) are named after their table by convention
  for (const m of schema.matchAll(/^model\s+([a-z][a-z0-9_]*)\s*\{/gm)) {
    tables.add(m[1]);
  }
  return tables;
}

describe("every migrated table is accounted for in the schema", () => {
  const history = tablesInHistory();
  const schema = tablesInSchema();

  it("finds the tables created by the migration history", () => {
    // Guards against this whole file silently passing on a regex that stopped
    // matching (e.g. a Prisma version change in SQL formatting).
    expect(history).toContain("potholes");
    expect(history).toContain("tenders");
    expect(history).toContain("users");
    expect(history).toContain("administrative_areas");
    expect(history).toContain("password_reset_tokens");
    expect(history).toContain("tender_sync_settings");
    expect(history).toContain("tender_sync_logs");
  });

  for (const table of ["potholes", "administrative_areas"]) {
    it(`${table} is unmodelled on purpose and documented in the schema`, () => {
      expect(RAW_SQL_MANAGED.has(table)).toBe(true);
      expect(schema.has(table)).toBe(false);

      // The comment at the deletion site must explain why, and warn about
      // migrate dev / db push. Without it the next reader has no way to know.
      const src = readSchema();
      const comment = src.slice(src.indexOf(`\`${table}\` table is NOT modelled`));
      expect(comment.length).toBeGreaterThan(0);
      expect(comment).toMatch(/migrate dev/);
      expect(comment).toMatch(/db push/);
    });
  }

  it("has no unaccounted-for table missing from the schema", () => {
    const unaccounted = [...history].filter(
      (t) => !schema.has(t) && !RAW_SQL_MANAGED.has(t),
    );
    expect(unaccounted).toEqual([]);
  });

  it("declares no model for a table that no migration creates", () => {
    const orphaned = [...schema].filter((t) => !history.has(t));
    expect(orphaned).toEqual([]);
  });
});

describe("the tender sync tables are now in the migration history", () => {
  // Finding: both tables were created at runtime by ensureTenderSyncTablesExist()
  // and appeared in no migration, so `prisma migrate deploy` produced a database
  // missing them. Fixed by migration 20261008120000_add_tender_sync_tables.
  it("creates tender_sync_settings with IF NOT EXISTS", () => {
    const sql = fs.readFileSync(
      path.join(
        MIGRATIONS_DIR,
        "20261008120000_add_tender_sync_tables",
        "migration.sql",
      ),
      "utf-8",
    );

    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS tender_sync_settings\s*\(/i,
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS tender_sync_logs\s*\(/i);
  });

  it("seeds the default settings row idempotently", () => {
    const sql = fs.readFileSync(
      path.join(
        MIGRATIONS_DIR,
        "20261008120000_add_tender_sync_tables",
        "migration.sql",
      ),
      "utf-8",
    );

    expect(sql).toMatch(/WHERE NOT EXISTS/i);
    expect(sql).toMatch(/INSERT INTO tender_sync_settings/i);
  });

  it("matches the runtime DDL column-for-column so the two paths cannot diverge", () => {
    const migration = fs.readFileSync(
      path.join(
        MIGRATIONS_DIR,
        "20261008120000_add_tender_sync_tables",
        "migration.sql",
      ),
      "utf-8",
    );
    const runtime = fs.readFileSync(
      path.join(BACKEND_ROOT, "src/services/tenderSyncService.ts"),
      "utf-8",
    );

    for (const table of ["tender_sync_settings", "tender_sync_logs"]) {
      const cols = (source: string) => {
        const clean = stripComments(source);
        const start = clean.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`);
        expect(start).toBeGreaterThan(-1);
        const body = clean.slice(start, clean.indexOf(");", start));
        // A column is `<name> <TYPE> ...`; requiring an upper-case type keeps
        // keywords like PRIMARY out of the capture and tolerates any indent.
        return [...body.matchAll(/^\s+([a-z_]+)\s+[A-Z][A-Za-z]*/gm)]
          .map((m) => m[1])
          .sort();
      };
      expect(cols(migration)).toEqual(cols(runtime));
    }
  });
});

describe("the partial unique index stays out of the schema", () => {
  // Prisma cannot express a partial index. Declaring a plain @@unique([block_id])
  // would make `prisma migrate diff` propose replacing the partial index with a
  // full one, permanently breaking re-tendering after a withdrawal.
  it("is not declared as a Prisma unique constraint", () => {
    // Strip comments first: the explanatory comment deliberately names
    // @@unique([block_id]) to warn against adding it.
    expect(stripComments(readSchema())).not.toMatch(/@@unique\(\s*\[block_id\]/);
  });

  it("documents why it is absent", () => {
    const schema = readSchema();
    expect(schema).toMatch(/PARTIAL unique index/i);
    expect(schema).toMatch(/migrate diff/);
  });
});

describe("dangerous Prisma commands are not wired up", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(BACKEND_ROOT, "package.json"), "utf-8"),
  );
  const scripts: Record<string, string> = pkg.scripts;

  it("prisma:migrate applies pending migrations instead of creating them", () => {
    // `prisma migrate dev` diffs the schema against history and would generate
    // DROP TABLE "potholes" now that the table is unmodelled.
    expect(scripts["prisma:migrate"]).toBe("prisma migrate deploy");
    expect(scripts["prisma:migrate"]).not.toMatch(/\bdev\b/);
  });

  it("does not expose prisma db push", () => {
    // `db push` introspects the live database and reconciles it toward the
    // schema, which would drop the unmodelled tables and their data.
    const all = Object.values(scripts).join(" ");
    expect(all).not.toMatch(/prisma db push/);
    expect(scripts["prisma:push"]).toBeUndefined();
  });
});

describe("the retained ReportStatus enum", () => {
  // No model uses it since Pothole was pruned, but raw SQL casts to it on every
  // status write. Removing it would make Prisma propose DROP TYPE.
  it("is still declared", () => {
    expect(readSchema()).toMatch(/enum ReportStatus/);
  });

  it("is explained in the schema so it is not pruned as dead code", () => {
    expect(readSchema()).toMatch(/ReportStatus[\s\S]{0,200}DROP TYPE/);
  });
});