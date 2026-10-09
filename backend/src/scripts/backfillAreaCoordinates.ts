/**
 * Backfill representative coordinates for `administrative_areas`.
 *
 * The LGD directory importer (importLgdCsv.ts) loads ids, names and hierarchy
 * codes but never loads coordinates, so every row currently has
 * latitude = NULL, longitude = NULL, boundary = NULL. Without coordinates there
 * is nothing for resolveBlockIdFromCoordinates() to match against, so reports
 * from the mobile client (which sends only GPS) cannot be assigned a block_id.
 *
 * This script forward-geocodes each area's name via Nominatim and writes the
 * representative point back. It is a ONE-OFF operational script, not part of
 * application startup.
 *
 * Nominatim's usage policy requires an identifying User-Agent and at most ~1
 * request per second, so this paces itself and retries with backoff. A full
 * Andhra Pradesh run is roughly 700 areas, so expect ~15 minutes.
 *
 * Usage:
 *   cd backend
 *   npm run backfill:areas -- --level=subdistrict      # most useful granularity
 *   npm run backfill:areas -- --level=all
 *   npm run backfill:areas -- --level=subdistrict --dry-run
 *
 * Environment:
 *   NOMINATIM_EMAIL        strongly recommended; nominatim.openstreetmap.org
 *                          asks for a contact address and may throttle harder
 *                          without one
 *   NOMINATIM_USER_AGENT   override the identifying User-Agent
 *   AREA_BACKFILL_DELAY_MS override the per-request delay (default 1100ms)
 */

import prisma from "../config/database";
import logger from "../config/logger";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const DEFAULT_DELAY_MS = 1100;
const MAX_ATTEMPTS = 3;

const LEVELS = ["state", "district", "subdistrict", "village"] as const;
type Level = (typeof LEVELS)[number];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

function userAgent(): string {
  return (
    process.env.NOMINATIM_USER_AGENT ||
    `PotholeReporter/1.0 (${process.env.NOMINATIM_EMAIL || "no-contact-set"})`
  );
}

/** Nominatim wants a place, not a bare name: qualify it with its hierarchy. */
function buildQuery(row: any): string[] {
  const state = row.state_name;
  const district = row.district_name;
  const mandal = row.subdistrict_name;

  if (row.level === "state") return [`${state}, India`];
  if (row.level === "district") return [`${district} district, ${state}, India`];
  if (row.level === "subdistrict") {
    return [`${mandal}, ${district}, ${state}, India`, `${mandal}, ${state}, India`];
  }
  return [`${row.name}, ${mandal}, ${district}, ${state}, India`, `${row.name}, ${state}, India`];
}

async function queryNominatim(query: string): Promise<{ lat: number; lon: number } | null> {
  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  if (process.env.NOMINATIM_EMAIL) url.searchParams.set("email", process.env.NOMINATIM_EMAIL);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // A timeout matters here: the original geocode path in routes/map.ts has
      // none, so a hung request can stall the caller indefinitely.
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent(), Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 429 || res.status >= 500) {
        const backoff = attempt * 4000;
        logger.warn({ query, status: res.status, backoff }, "Nominatim throttled; retrying");
        await sleep(backoff);
        continue;
      }
      if (!res.ok) {
        logger.warn({ query, status: res.status }, "Nominatim returned an error");
        return null;
      }

      const results = (await res.json()) as any[];
      const first = results?.[0];
      if (!first?.lat || !first?.lon) return null;
      return { lat: Number(first.lat), lon: Number(first.lon) };
    } catch (err: any) {
      if (err?.name === "TimeoutError") {
        logger.warn({ query, attempt }, "Nominatim request timed out");
      } else {
        logger.warn({ err, query, attempt }, "Nominatim request failed");
      }
      await sleep(attempt * 3000);
    }
  }
  return null;
}

async function main() {
  const requested = (argValue("level") || "subdistrict").toLowerCase();
  const dryRun = process.argv.includes("--dry-run");
  const delayMs = Number(process.env.AREA_BACKFILL_DELAY_MS || DEFAULT_DELAY_MS);

  if (requested !== "all" && !LEVELS.includes(requested as Level)) {
    console.error(`--level must be one of: ${LEVELS.join(", ")}, all`);
    process.exit(1);
  }
  const levels: Level[] = requested === "all" ? [...LEVELS] : [requested as Level];

  if (!process.env.NOMINATIM_EMAIL && !dryRun) {
    logger.warn(
      "NOMINATIM_EMAIL is not set — nominatim.openstreetmap.org may throttle aggressively",
    );
  }

  const rows: any[] = await prisma.$queryRawUnsafe(
    `
    SELECT id, name, level, state_name, district_name, subdistrict_name, latitude, longitude
    FROM administrative_areas
    WHERE level = ANY($1::text[])
    ORDER BY
      CASE level
        WHEN 'state' THEN 0
        WHEN 'district' THEN 1
        WHEN 'subdistrict' THEN 2
        ELSE 3
      END,
      name
    `,
    levels,
  );

  const pending = rows.filter((r) => r.latitude === null || r.longitude === null);
  logger.info(
    { requested, total: rows.length, pending: pending.length, dryRun },
    "Administrative area coordinate backfill starting",
  );

  let resolved = 0;
  let failed = 0;

  for (const [index, row] of pending.entries()) {
    let coords: { lat: number; lon: number } | null = null;

    for (const query of buildQuery(row)) {
      coords = await queryNominatim(query);
      if (coords) break;
      await sleep(delayMs);
    }

    if (coords) {
      resolved += 1;
      if (!dryRun) {
        await prisma.$executeRawUnsafe(
          `
          UPDATE administrative_areas
          SET latitude = $2, longitude = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          `,
          row.id,
          coords.lat,
          coords.lon,
        );
      }
      logger.info(
        { id: row.id, name: row.name, level: row.level, ...coords },
        `${dryRun ? "[dry-run] would set" : "set"} coordinates`,
      );
    } else {
      failed += 1;
      logger.warn({ id: row.id, name: row.name, level: row.level }, "no coordinate found");
    }

    // Pace to Nominatim's 1 req/s policy.
    if (index < pending.length - 1) await sleep(delayMs);
  }

  logger.info({ total: pending.length, resolved, failed, dryRun }, "Backfill complete");

  if (resolved === 0 && pending.length > 0) {
    logger.error(
      "Nothing was resolved. Until administrative_areas has coordinates, mobile reports cannot be assigned a block_id.",
    );
    process.exitCode = 2;
  }
}

main()
  .catch((err) => {
    logger.error({ err }, "Backfill failed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });