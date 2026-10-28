import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import prisma from "../config/database";
import logger from "../config/logger";
import { publicReadLimiter } from "../middleware/rateLimiter";

const router = Router();
const NOMINATIM_URL = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const MAP_TILE_URL_TEMPLATE = process.env.MAP_TILE_URL_TEMPLATE || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT || "PotholeReporter/1.0 (maps@example.invalid)";
const SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;
const SEARCH_MIN_INTERVAL_MS = 1100;
const MAX_CACHE_ENTRIES = 500;

const nominatimLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many map lookup requests. Please wait a moment." },
});

interface NominatimPlace {
  osm_type: string;
  osm_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
  geojson?: GeoJSON.GeoJsonObject;
}

type AdministrativeLevel = "district" | "subdistrict" | "village";

interface DirectoryAreaRow {
  id: string;
  name: string;
  level: string;
  state_code: string | null;
  state_name: string | null;
  district_code: string | null;
  district_name: string | null;
  subdistrict_code: string | null;
  subdistrict_name: string | null;
  latitude: number | null;
  longitude: number | null;
  bbox: unknown;
}

const placeCache = new Map<string, { expiresAt: number; value: NominatimPlace[] }>();
let lastLookupAt = 0;

function cacheSet(key: string, value: NominatimPlace[]) {
  if (placeCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = placeCache.keys().next().value;
    if (oldest) placeCache.delete(oldest);
  }
  placeCache.set(key, { value, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
}

function readNumber(value: unknown, minimum: number, maximum: number): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function normalizeLevel(value: string): AdministrativeLevel | null {
  const level = value.trim().toLowerCase();
  if (level === "district") return "district";
  if (level === "subdistrict" || level === "mandal" || level === "block") return "subdistrict";
  if (level === "village" || level === "locality" || level === "city") return "village";
  return null;
}

function toArea(place: NominatimPlace, areaType: string) {
  const [south, north, west, east] = place.boundingbox.map(Number);
  return {
    id: `${place.osm_type}-${place.osm_id}`,
    name: place.display_name.split(",")[0],
    displayName: place.display_name,
    type: areaType,
    stateName: "Andhra Pradesh",
    center: { latitude: Number(place.lat), longitude: Number(place.lon) },
    latitude: Number(place.lat),
    longitude: Number(place.lon),
    bounds: { south, west, north, east },
    bbox: { south, west, north, east },
    boundary: place.geojson || null,
    detail: place.display_name,
  };
}

function toOption(place: NominatimPlace, type: string) {
  return {
    id: `${place.osm_type}-${place.osm_id}`,
    name: place.display_name.split(",")[0],
    displayName: place.display_name,
    detail: place.display_name,
    type,
    latitude: Number(place.lat),
    longitude: Number(place.lon),
    bbox: null,
  };
}

async function searchNominatim(query: string): Promise<NominatimPlace[]> {
  const cached = placeCache.get(query);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const waitMs = Math.max(0, SEARCH_MIN_INTERVAL_MS - (Date.now() - lastLookupAt));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastLookupAt = Date.now();

  const url = new URL("/search", NOMINATIM_URL);
  url.search = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    polygon_geojson: "1",
    countrycodes: "in",
    limit: "5",
    q: query,
  }).toString();

  const response = await fetch(url, {
    headers: { "User-Agent": NOMINATIM_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Place search failed with ${response.status}`);

  const places = (await response.json()) as NominatimPlace[];
  cacheSet(query, places);
  return places;
}

async function searchDirectory(input: {
  level: AdministrativeLevel;
  state: string;
  district: string;
  districtCode: string;
  mandal: string;
  subdistrictCode: string;
  query: string;
}): Promise<DirectoryAreaRow[]> {
  const levels =
    input.level === "district"
      ? ["district"]
      : input.level === "subdistrict"
        ? ["subdistrict", "mandal", "block"]
        : ["village", "city", "municipality", "panchayat", "region"];
  const match = input.query.toLocaleLowerCase();
  return prisma.$queryRawUnsafe<DirectoryAreaRow[]>(
    `SELECT
       id, name, level, state_code, state_name, district_code, district_name,
       subdistrict_code, subdistrict_name, latitude, longitude, bbox
     FROM administrative_areas
     WHERE level = ANY($1::text[])
       AND ($2 = '' OR LOWER(COALESCE(state_name, '')) = LOWER($2))
       AND ($3 = '' OR LOWER(COALESCE(district_name, '')) = LOWER($3))
       AND ($4 = '' OR district_code = $4)
       AND ($5 = '' OR LOWER(COALESCE(subdistrict_name, '')) = LOWER($5))
       AND ($6 = '' OR subdistrict_code = $6)
       AND ($7 = '' OR normalized_name LIKE $7 || '%')
     ORDER BY name ASC
     LIMIT 30`,
    levels,
    input.state,
    input.district,
    input.districtCode,
    input.mandal,
    input.subdistrictCode,
    match,
  );
}

function directoryOption(row: DirectoryAreaRow) {
  const detail = [row.subdistrict_name, row.district_name, row.state_name].filter(Boolean).join(", ");
  return {
    id: row.id,
    name: row.name,
    displayName: [row.name, row.subdistrict_name, row.district_name, row.state_name, "India"]
      .filter(Boolean)
      .join(", "),
    detail: detail || row.name,
    type: row.level,
    stateCode: row.state_code,
    stateName: row.state_name,
    districtCode: row.district_code,
    districtName: row.district_name,
    subdistrictCode: row.subdistrict_code,
    subdistrictName: row.subdistrict_name,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    bbox: row.bbox ?? null,
  };
}

router.get("/config", (_req: Request, res: Response) => {
  res.json({
    tileUrlTemplate: MAP_TILE_URL_TEMPLATE,
    attribution: process.env.MAP_ATTRIBUTION || "(c) OpenStreetMap contributors (c) CARTO",
    minZoom: 7,
    maxZoom: 19,
  });
});

router.get("/areas/search", nominatimLimiter, async (req: Request, res: Response) => {
  const state = String(req.query.state || "").trim();
  const district = String(req.query.district || "").trim();
  const mandal = String(req.query.mandal || "").trim();
  const locality = String(req.query.locality || "").trim();
  const type = String(req.query.type || "municipality").trim();
  const query = [locality, mandal, district, state, "India"].filter(Boolean).join(", ");

  if (!state || (!district && !locality)) {
    return res.status(400).json({ error: "State and District or locality are required" });
  }

  try {
    const places = await searchNominatim(query);
    res.json({ areas: places.map((place) => toArea(place, type)) });
  } catch (err) {
    logger.error({ err, query }, "Map area search failed");
    res.status(502).json({ error: "Map area search is unavailable" });
  }
});

router.get("/areas/options", nominatimLimiter, async (req: Request, res: Response) => {
  const level = normalizeLevel(String(req.query.level || ""));
  const state = String(req.query.state || "Andhra Pradesh").trim();
  const district = String(req.query.district || "").trim();
  const districtCode = String(req.query.districtCode || "").trim();
  const mandal = String(req.query.mandal || "").trim();
  const subdistrictCode = String(req.query.subdistrictCode || "").trim();
  const query = String(req.query.q ?? req.query.query ?? "").trim();

  if (!level) {
    return res.status(400).json({ error: "A valid administrative level is required" });
  }
  if (!state) {
    return res.status(400).json({ error: "State is required" });
  }
  if ((level === "subdistrict" || level === "village") && !district && !districtCode) {
    return res.status(400).json({ error: "District is required before selecting a mandal" });
  }
  if (level === "village" && !mandal && !subdistrictCode) {
    return res.status(400).json({ error: "Mandal is required before selecting an area" });
  }

  try {
    const directoryMatches = await searchDirectory({
      level,
      state,
      district,
      districtCode,
      mandal,
      subdistrictCode,
      query,
    });
    if (directoryMatches.length || query.length < 2) {
      const options = directoryMatches.map(directoryOption);
      return res.json({ options, areas: options, source: "directory" });
    }
  } catch (err) {
    logger.warn({ err }, "Administrative directory is not ready; using place lookup");
  }

  const context = [mandal, district, state, "India"].filter(Boolean);
  const searchTerm = level === "district" ? `${query} district` : query;
  const searchQuery = [searchTerm, ...context].join(", ");
  try {
    const places = await searchNominatim(searchQuery);
    const unique = new Map<string, ReturnType<typeof toOption>>();
    for (const place of places) unique.set(`${place.osm_type}-${place.osm_id}`, toOption(place, level));
    const options = Array.from(unique.values());
    res.json({ options, areas: options, source: "development-place-lookup" });
  } catch (err) {
    logger.error({ err, searchQuery, level }, "Administrative area options unavailable");
    res.status(502).json({ error: "Area suggestions are unavailable" });
  }
});

router.get("/areas/current", nominatimLimiter, async (req: Request, res: Response) => {
  const latitude = readNumber(req.query.latitude, -90, 90);
  const longitude = readNumber(req.query.longitude, -180, 180);
  if (latitude === null || longitude === null) {
    return res.status(400).json({ error: "Valid latitude and longitude are required" });
  }

  res.json({
    area: {
      id: "current-location",
      name: "Current location",
      displayName: "Current location",
      type: "nearby",
      center: { latitude, longitude },
      latitude,
      longitude,
      bounds: {
        south: latitude - 0.25,
        north: latitude + 0.25,
        west: longitude - 0.25,
        east: longitude + 0.25,
      },
      bbox: {
        south: latitude - 0.25,
        north: latitude + 0.25,
        west: longitude - 0.25,
        east: longitude + 0.25,
      },
      boundary: null,
    },
  });
});

function parseBbox(value: unknown): [number, number, number, number] | null {
  if (typeof value !== "string") return null;
  const parts = value.split(",").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [west, south, east, north] = parts;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) return null;
  return [west, south, east, north];
}

interface PublicIssueRow {
  id: string;
  latitude: number;
  longitude: number;
  status: string;
  condition: string | null;
  severity_score: number | null;
  pothole_count: number | null;
  evidence_count: number | null;
  block_id: string | null;
  created_at: Date;
  last_detected_at: Date;
  image_s3_key: string | null;
}

/**
 * Public map layer: one pin per physical issue, plus unlinked pending reports
 * so AI downtime never blanks the map. `road_issues` is authoritative for
 * verified/fixed defects.
 */
router.get("/potholes", publicReadLimiter, async (req: Request, res: Response) => {
  const bbox = parseBbox(req.query.bbox);
  if (!bbox) return res.status(400).json({ error: "bbox must be west,south,east,north" });
  const [west, south, east, north] = bbox;

  try {
    const issues = await prisma.$queryRawUnsafe<PublicIssueRow[]>(
      `SELECT
         ri.id,
         ST_Y(ri.location::geometry) AS latitude,
         ST_X(ri.location::geometry) AS longitude,
         ri.status,
         ri.condition,
         ri.severity_score,
         ri.pothole_count,
         ri.evidence_count,
         ri.block_id,
         ri.first_detected_at AS created_at,
         ri.last_detected_at,
         (SELECT p.image_s3_key FROM potholes p
           WHERE p.canonical_issue_id = ri.id
           ORDER BY p.created_at DESC LIMIT 1) AS image_s3_key
       FROM road_issues ri
       WHERE ri.status <> 'dismissed'
         AND ri.location && ST_MakeEnvelope($1, $2, $3, $4, 4326)
       ORDER BY ri.last_detected_at DESC
       LIMIT 3000`,
      west,
      south,
      east,
      north,
    );

    const pending = await prisma.$queryRawUnsafe<PublicIssueRow[]>(
      `SELECT
         p.id,
         ST_Y(p.location::geometry) AS latitude,
         ST_X(p.location::geometry) AS longitude,
         'pending' AS status,
         NULL::varchar AS condition,
         NULL::numeric AS severity_score,
         NULL::integer AS pothole_count,
         1 AS evidence_count,
         p.block_id,
         p.created_at,
         p.created_at AS last_detected_at,
         p.image_s3_key
       FROM potholes p
       WHERE p.status = 'pending'
         AND p.canonical_issue_id IS NULL
         AND p.location && ST_MakeEnvelope($1, $2, $3, $4, 4326)
       ORDER BY p.created_at DESC
       LIMIT 1000`,
      west,
      south,
      east,
      north,
    );

    const potholes = [
      ...issues.map((row) => ({
        id: row.id,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        status: row.status === "active" ? "verified" : row.status === "fixed" ? "fixed" : "rejected",
        condition: row.condition,
        severity_score: row.severity_score === null ? null : Number(row.severity_score),
        pothole_count: row.pothole_count === null ? null : Number(row.pothole_count),
        evidence_count: Number(row.evidence_count || 1),
        block_id: row.block_id,
        created_at: row.created_at,
        last_detected_at: row.last_detected_at,
        image_s3_key: row.image_s3_key,
      })),
      ...pending.map((row) => ({
        id: row.id,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        status: "pending",
        condition: null,
        severity_score: null,
        pothole_count: null,
        evidence_count: 1,
        block_id: row.block_id,
        created_at: row.created_at,
        last_detected_at: row.last_detected_at,
        image_s3_key: row.image_s3_key,
      })),
    ];

    res.json({ potholes });
  } catch (err) {
    logger.error({ err }, "Public map query failed");
    res.status(500).json({ error: "Could not load public reports" });
  }
});

// Compatibility endpoint for the handoff website client. The main website uses
// /map/potholes above.
router.get("/reports", publicReadLimiter, async (req: Request, res: Response) => {
  const south = readNumber(req.query.south, -90, 90);
  const west = readNumber(req.query.west, -180, 180);
  const north = readNumber(req.query.north, -90, 90);
  const east = readNumber(req.query.east, -180, 180);
  if (south === null || west === null || north === null || east === null || south >= north || west >= east) {
    return res.status(400).json({ error: "Valid map bounds are required" });
  }

  try {
    const reports = await prisma.$queryRawUnsafe(
      `SELECT id, ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude,
              status, last_detected_at AS created_at, condition, severity_score,
              pothole_count, confidence, evidence_count, block_id,
              (SELECT p.image_s3_key FROM potholes p WHERE p.canonical_issue_id = road_issues.id ORDER BY p.created_at DESC LIMIT 1) AS image_s3_key
       FROM road_issues
       WHERE status <> 'dismissed'
         AND ST_Intersects(location::geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
       ORDER BY last_detected_at DESC
       LIMIT 3000`,
      west,
      south,
      east,
      north,
    );
    const tender = await prisma.$queryRawUnsafe<Array<{ generated_at: Date | null }>>(
      "SELECT MAX(generated_at) AS generated_at FROM tenders",
    );
    res.json({ reports, lastTenderedAt: tender[0]?.generated_at || null });
  } catch (err) {
    logger.error({ err }, "Map report query failed");
    res.status(500).json({ error: "Could not load public reports" });
  }
});

export default router;
