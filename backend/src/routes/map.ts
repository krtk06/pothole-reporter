import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import prisma from "../config/database";
import logger from "../config/logger";

const router = Router();

const ANDHRA_STATE_CODE = "28";
const ANDHRA_STATE_NAME = "Andhra Pradesh";
const MAX_RESULTS = 30;

const nominatimLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many map lookup requests. Please wait a moment." },
});

const levelSchema = z.enum(["district", "subdistrict", "village"]);

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function toPublicArea(row: any) {
  return {
    id: row.id,
    name: row.name,
    displayName: [
      row.name,
      row.level === "village" ? row.subdistrict_name : null,
      row.level !== "district" ? row.district_name : null,
      row.state_name,
      "India",
    ].filter(Boolean).join(", "),
    type: row.level,
    stateCode: row.state_code,
    stateName: row.state_name,
    districtCode: row.district_code,
    districtName: row.district_name,
    subdistrictCode: row.subdistrict_code,
    subdistrictName: row.subdistrict_name,
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    bbox: row.bbox ?? null,
    boundary: row.boundary_geojson ?? null,
  };
}

function fallbackAreaFromQuery(req: Request) {
  const id = typeof req.query.id === "string" ? req.query.id : undefined;
  const name = typeof req.query.name === "string" ? req.query.name : undefined;
  if (!id || !name) return null;

  const districtName = typeof req.query.districtName === "string" ? req.query.districtName : undefined;
  const subdistrictName = typeof req.query.subdistrictName === "string" ? req.query.subdistrictName : undefined;
  const districtCode = typeof req.query.districtCode === "string" ? req.query.districtCode : undefined;
  const subdistrictCode = typeof req.query.subdistrictCode === "string" ? req.query.subdistrictCode : undefined;
  const level = id.startsWith("district:")
    ? "district"
    : id.startsWith("subdistrict:")
    ? "subdistrict"
    : "village";

  return {
    id,
    name,
    level,
    state_code: ANDHRA_STATE_CODE,
    state_name: ANDHRA_STATE_NAME,
    district_code: districtCode || null,
    district_name: districtName || (level === "district" ? name : null),
    subdistrict_code: subdistrictCode || null,
    subdistrict_name: subdistrictName || (level === "subdistrict" ? name : null),
    latitude: null,
    longitude: null,
    bbox: null,
    boundary_geojson: null,
  };
}

async function fetchAreas(level: string, q?: string, districtCode?: string, subdistrictCode?: string) {
  const conditions = ["level = $1", "state_code = $2"];
  const params: any[] = [level, ANDHRA_STATE_CODE];
  let index = 3;

  if (districtCode) {
    conditions.push(`district_code = $${index++}`);
    params.push(districtCode);
  }

  if (subdistrictCode) {
    conditions.push(`subdistrict_code = $${index++}`);
    params.push(subdistrictCode);
  }

  if (q) {
    conditions.push(`normalized_name LIKE $${index++}`);
    params.push(`${normalizeName(q)}%`);
  }

  return prisma.$queryRawUnsafe(`
    SELECT
      id, name, level, state_code, state_name,
      district_code, district_name, subdistrict_code, subdistrict_name,
      latitude, longitude, bbox
    FROM administrative_areas
    WHERE ${conditions.join(" AND ")}
    ORDER BY name ASC
    LIMIT ${MAX_RESULTS}
  `, ...params);
}

router.get("/areas/options", async (req: Request, res: Response) => {
  try {
    const levelResult = levelSchema.safeParse(req.query.level);
    if (!levelResult.success) {
      return res.status(400).json({ error: "Invalid level" });
    }

    const areas = await fetchAreas(
      levelResult.data,
      typeof req.query.q === "string" ? req.query.q : undefined,
      typeof req.query.districtCode === "string" ? req.query.districtCode : undefined,
      typeof req.query.subdistrictCode === "string" ? req.query.subdistrictCode : undefined
    );

    res.json({ areas: (areas as any[]).map(toPublicArea) });
  } catch (err) {
    logger.error({ err }, "Map options error");
    res.status(500).json({ error: "Failed to load administrative options" });
  }
});

router.get("/areas/search", async (req: Request, res: Response) => {
  try {
    const query = z.string().trim().min(1).max(100).safeParse(req.query.q);
    const levelResult = levelSchema.optional().safeParse(req.query.level);
    if (!query.success || !levelResult.success) {
      return res.status(400).json({ error: "Invalid search query" });
    }

    const levels = levelResult.data ? [levelResult.data] : ["district", "subdistrict", "village"];
    const searches = await Promise.all(
      levels.map((level) => fetchAreas(
        level,
        query.data,
        typeof req.query.districtCode === "string" ? req.query.districtCode : undefined,
        typeof req.query.subdistrictCode === "string" ? req.query.subdistrictCode : undefined
      ))
    );

    res.json({ areas: searches.flat().slice(0, MAX_RESULTS).map(toPublicArea) });
  } catch (err) {
    logger.error({ err }, "Map search error");
    res.status(500).json({ error: "Failed to search administrative areas" });
  }
});

async function geocodeArea(area: any) {
  const query = [
    area.name,
    area.subdistrict_name,
    area.district_name,
    ANDHRA_STATE_NAME,
    "India",
  ].filter(Boolean).join(", ");

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("addressdetails", "0");

  const response = await fetch(url, {
    headers: {
      "User-Agent": process.env.NOMINATIM_USER_AGENT || "pothole-reporter/1.0 contact@example.com",
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim returned ${response.status}`);
  }

  const results = await response.json() as any[];
  const first = results[0];
  if (!first?.lat || !first?.lon) {
    throw new Error("No coordinate found for selected area");
  }

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  const bbox = Array.isArray(first.boundingbox)
    ? {
        south: Number(first.boundingbox[0]),
        north: Number(first.boundingbox[1]),
        west: Number(first.boundingbox[2]),
        east: Number(first.boundingbox[3]),
      }
    : {
        south: latitude - 0.0045,
        north: latitude + 0.0045,
        west: longitude - 0.0045,
        east: longitude + 0.0045,
      };

  const geojson = first.geojson && ["Polygon", "MultiPolygon"].includes(first.geojson.type)
    ? first.geojson
    : null;

  const updated: any[] = await prisma.$queryRawUnsafe(`
    UPDATE administrative_areas
    SET
      latitude = $1,
      longitude = $2,
      bbox = $3::jsonb,
      boundary = CASE
        WHEN $4::jsonb IS NULL THEN boundary
        ELSE ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($4::text), 4326))
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING
      id, name, level, state_code, state_name,
      district_code, district_name, subdistrict_code, subdistrict_name,
      latitude, longitude, bbox,
      CASE WHEN boundary IS NULL THEN NULL ELSE ST_AsGeoJSON(boundary)::json END as boundary_geojson
  `, latitude, longitude, JSON.stringify(bbox), geojson ? JSON.stringify(geojson) : null, area.id);

  if (updated[0]) return updated[0];

  const inserted: any[] = await prisma.$queryRawUnsafe(`
    INSERT INTO administrative_areas (
      id, name, normalized_name, level, state_code, state_name,
      district_code, district_name, subdistrict_code, subdistrict_name,
      latitude, longitude, bbox, boundary, source
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13::jsonb,
      CASE
        WHEN $14::jsonb IS NULL THEN NULL
        ELSE ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($14::text), 4326))
      END,
      'LGD administrative directory + Nominatim'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      normalized_name = EXCLUDED.normalized_name,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      bbox = EXCLUDED.bbox,
      boundary = COALESCE(EXCLUDED.boundary, administrative_areas.boundary),
      updated_at = CURRENT_TIMESTAMP
    RETURNING
      id, name, level, state_code, state_name,
      district_code, district_name, subdistrict_code, subdistrict_name,
      latitude, longitude, bbox,
      CASE WHEN boundary IS NULL THEN NULL ELSE ST_AsGeoJSON(boundary)::json END as boundary_geojson
  `, area.id, area.name, normalizeName(area.name), area.level, area.state_code, area.state_name,
    area.district_code, area.district_name, area.subdistrict_code, area.subdistrict_name,
    latitude, longitude, JSON.stringify(bbox), geojson ? JSON.stringify(geojson) : null);

  return inserted[0];
}

router.get("/areas/current", nominatimLimiter, async (req: Request, res: Response) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    const villageCode = typeof req.query.villageCode === "string" ? req.query.villageCode : undefined;
    if (!id && !villageCode) {
      return res.status(400).json({ error: "id or villageCode is required" });
    }

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        id, name, level, state_code, state_name,
        district_code, district_name, subdistrict_code, subdistrict_name,
        latitude, longitude, bbox,
        CASE WHEN boundary IS NULL THEN NULL ELSE ST_AsGeoJSON(boundary)::json END as boundary_geojson
      FROM administrative_areas
      WHERE ${id ? "id = $1" : "id = $1 OR id = CONCAT('village:', $1)"}
      LIMIT 1
    `, id || villageCode);

    if (rows.length === 0) {
      const fallbackArea = fallbackAreaFromQuery(req);
      if (fallbackArea) {
        const area = await geocodeArea(fallbackArea);
        return res.json({ area: toPublicArea(area) });
      }
      return res.status(404).json({ error: "Administrative area not found" });
    }

    const area = rows[0].latitude && rows[0].longitude ? rows[0] : await geocodeArea(rows[0]);
    res.json({ area: toPublicArea(area) });
  } catch (err: any) {
    logger.error({ err }, "Current map area error");
    res.status(500).json({ error: err.message || "Failed to resolve selected location" });
  }
});

router.get("/potholes", async (req: Request, res: Response) => {
  try {
    const bbox = z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/).safeParse(req.query.bbox);
    if (!bbox.success) {
      return res.status(400).json({ error: "bbox must be west,south,east,north" });
    }
    const [west, south, east, north] = bbox.data.split(",").map(Number);

    const reports: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        id,
        ST_X(location::geometry) as longitude,
        ST_Y(location::geometry) as latitude,
        status,
        block_id,
        created_at
      FROM potholes
      WHERE status IN ('verified', 'pending')
        AND location && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      ORDER BY created_at DESC
      LIMIT 1000
    `, west, south, east, north);

    res.json({
      potholes: reports.map((report) => ({
        id: report.id,
        latitude: Number(report.latitude),
        longitude: Number(report.longitude),
        status: report.status,
        block_id: report.block_id,
        created_at: report.created_at,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Visible map potholes error");
    res.status(500).json({ error: "Failed to fetch map potholes" });
  }
});

export default router;
