import prisma from "../config/database";
import logger from "../config/logger";

const MAX_RESOLUTION_METERS = Number(process.env.BLOCK_RESOLUTION_MAX_METERS || 75_000);

export function buildBlockId(state?: string | null, district?: string | null, mandal?: string | null): string | null {
  const parts = [state, district, mandal]
    .map((part) => (part || "").trim().replace(/\s+/g, " ").toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join("/").slice(0, 100);
}

export function normalizeBlockId(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();
  if (!/^[a-z0-9][a-z0-9 /-]*$/.test(normalized)) return null;
  return normalized.slice(0, 100);
}

interface AreaRow {
  name: string;
  state_name: string | null;
  district_name: string | null;
  subdistrict_name: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_m: number | null;
}

async function nearestArea(latitude: number, longitude: number, levels: string[]): Promise<AreaRow | null> {
  const rows = await prisma.$queryRawUnsafe<AreaRow[]>(
    `SELECT
       name, state_name, district_name, subdistrict_name, latitude, longitude,
       (6371000 * acos(
         LEAST(1, GREATEST(-1,
           cos(radians($1)) * cos(radians(latitude)) *
           cos(radians(longitude) - radians($2)) +
           sin(radians($1)) * sin(radians(latitude))
         ))
       )) AS distance_m
     FROM administrative_areas
     WHERE level = ANY($3::text[])
       AND latitude IS NOT NULL
       AND longitude IS NOT NULL
     ORDER BY distance_m ASC
     LIMIT 1`,
    latitude,
    longitude,
    levels,
  );
  return rows[0] || null;
}

/**
 * Resolve a report's jurisdiction from GPS. Mobile clients send only
 * coordinates, so without this a report matches no admin scope predicate and
 * can never reach the tender threshold.
 */
export async function resolveBlockIdFromCoordinates(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  try {
    const subdistrict = await nearestArea(latitude, longitude, ["subdistrict", "mandal", "block"]);
    if (subdistrict && (subdistrict.distance_m === null || subdistrict.distance_m <= MAX_RESOLUTION_METERS)) {
      const blockId = buildBlockId(
        subdistrict.state_name,
        subdistrict.district_name,
        subdistrict.subdistrict_name || subdistrict.name,
      );
      if (blockId) return blockId;
    }

    const district = await nearestArea(latitude, longitude, ["district"]);
    if (district && (district.distance_m === null || district.distance_m <= MAX_RESOLUTION_METERS)) {
      return buildBlockId(district.state_name, district.district_name || district.name, null);
    }

    const state = await nearestArea(latitude, longitude, ["state"]);
    if (state && (state.distance_m === null || state.distance_m <= MAX_RESOLUTION_METERS)) {
      return buildBlockId(state.state_name || state.name, null, null);
    }
  } catch (err) {
    // A report must still be accepted if the directory is unavailable.
    logger.warn({ err, latitude, longitude }, "Could not resolve block_id from coordinates");
  }
  return null;
}

export async function resolveBlockIdIfMissing(
  blockId: string | undefined,
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const provided = normalizeBlockId(blockId);
  if (provided) return provided;
  return resolveBlockIdFromCoordinates(latitude, longitude);
}

export async function resolveDistrictForMandal(
  state: string | null | undefined,
  mandal: string,
): Promise<string | null> {
  if (!state || !mandal) return null;
  const rows = await prisma.$queryRawUnsafe<Array<{ district_name: string | null }>>(
    `SELECT district_name
     FROM administrative_areas
     WHERE level = ANY($1::text[])
       AND LOWER(COALESCE(state_name, '')) = LOWER($2)
       AND LOWER(COALESCE(subdistrict_name, name)) = LOWER($3)
       AND district_name IS NOT NULL
     LIMIT 1`,
    ["subdistrict", "mandal", "block"],
    state,
    mandal,
  );
  return rows[0]?.district_name || null;
}
