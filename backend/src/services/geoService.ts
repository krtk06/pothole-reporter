import prisma from "../config/database";
import logger from "../config/logger";

/**
 * Resolve a report's `block_id` from its coordinates.
 *
 * `block_id` is the join key the whole admin system hangs off: admin scope
 * prefixes (`getScopePrefix`) are matched against it as
 * `block_id = $prefix OR block_id LIKE $prefix/%`, and the tender threshold
 * counts `WHERE block_id = $1`. A report submitted without one is therefore
 * invisible to every scoped admin query and can never reach the tender
 * threshold — which is the state the mobile client was in, since it only ever
 * sends raw GPS.
 *
 * `administrative_areas` carries a representative point per area (latitude /
 * longitude). Resolving to the nearest one is a nearest-neighbour lookup, not a
 * point-in-polygon test: the `boundary` MultiPolygon column is null for every
 * row loaded from the LGD directory, so containment is not available.
 *
 * Granularity preference is subdistrict (mandal) > district > state, because
 * block_id is `state/district/mandal` and that is the shape the admin scope
 * prefixes expect.
 */

/** Refuse to guess beyond this distance (metres). Beyond it, block_id stays null. */
const MAX_DISTANCE_METERS = 75_000;

export interface ResolvedBlock {
  blockId: string;
  level: string;
  meters: number;
}

function slug(value?: string | null): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Map a matched row to the block_id shape the admin scope prefixes expect. */
function toBlockId(row: any): string {
  const state = slug(row.state_name);
  const district = slug(row.district_name);
  const mandal = slug(row.subdistrict_name);

  if (row.level === "subdistrict" && state && district && mandal) {
    return `${state}/${district}/${mandal}`;
  }
  if (row.level === "district" && state && district) {
    return `${state}/${district}`;
  }
  return state;
}

/**
 * Nearest administrative area to (latitude, longitude), or null when nothing is
 * within MAX_DISTANCE_METERS or no coordinates have been backfilled yet.
 */
export async function resolveBlockIdFromCoordinates(
  latitude: number,
  longitude: number,
): Promise<ResolvedBlock | null> {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `
    SELECT level, state_name, district_name, subdistrict_name, meters
    FROM (
      SELECT
        level,
        state_name,
        district_name,
        subdistrict_name,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) AS meters,
        CASE level
          WHEN 'subdistrict' THEN 0
          WHEN 'district'   THEN 1
          ELSE 2
        END AS prio
      FROM administrative_areas
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND level IN ('subdistrict', 'district', 'state')
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
    ) AS candidates
    ORDER BY prio ASC, meters ASC
    LIMIT 3
  `,
    longitude,
    latitude,
    MAX_DISTANCE_METERS,
  );

  // Rows arrive already ordered by granularity preference, then distance.
  for (const row of rows) {
    const blockId = toBlockId(row);
    if (blockId) {
      return { blockId, level: row.level, meters: Number(row.meters) };
    }
  }

  return null;
}

/**
 * Resolve a block_id only when the caller did not supply one. Never throws: a
 * report must still be accepted if the lookup fails.
 */
export async function resolveBlockIdIfMissing(
  supplied: string | null | undefined,
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (supplied) return supplied;

  try {
    const resolved = await resolveBlockIdFromCoordinates(latitude, longitude);
    if (!resolved) {
      logger.info(
        { latitude, longitude },
        "No administrative area within range — report stored without block_id",
      );
      return null;
    }
    logger.info(
      { latitude, longitude, blockId: resolved.blockId, meters: Math.round(resolved.meters) },
      "Resolved block_id from coordinates",
    );
    return resolved.blockId;
  } catch (err) {
    logger.error({ err }, "block_id resolution failed; storing report without one");
    return null;
  }
}