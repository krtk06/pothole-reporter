/**
 * Map tile source.
 *
 * Preferred source is the server's own configuration at
 * `GET /map/config`, which currently serves the CartoDB light_all
 * basemap. Reading it means changing the basemap needs no frontend
 * rebuild or redeploy, and attribution stays owned by whoever configured
 * it rather than hardcoded here.
 *
 * Two fallbacks keep maps rendering if that request fails:
 *   1. NEXT_PUBLIC_MAP_TILE_URL, inlined at build time
 *   2. OpenStreetMap standard raster tiles
 *
 * `{s}` (subdomain) and `{r}` (retina) are substituted by Leaflet, so a
 * Carto URL can be pasted in verbatim.
 *
 * Attribution is not optional: every source below is derived from
 * OpenStreetMap data, so credit is a licence requirement regardless of
 * which provider actually serves the tiles.
 */

"use client";

import { useEffect, useState } from "react";

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const CARTO_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const ENV_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL;

export const FALLBACK_MAP_CONFIG = {
  tileUrlTemplate: ENV_TILE_URL || OSM_TILE_URL,
  attribution:
    ENV_TILE_URL && ENV_TILE_URL !== OSM_TILE_URL
      ? `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`
      : OSM_ATTRIBUTION,
  minZoom: 7,
  maxZoom: 19,
};

/**
 * Only accept a template Leaflet can actually substitute. A blank or
 * non-string value would render a blank basemap on both sites, so treat
 * it as unusable rather than passing it through.
 */
function isUsableTemplate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.includes("{z}") &&
    value.includes("{x}") &&
    value.includes("{y}")
  );
}

export interface MapConfig {
  tileUrlTemplate: string;
  attribution: string;
  minZoom: number;
  maxZoom: number;
}

/**
 * A tile smaller than this is not real basemap imagery.
 *
 * CartoDB now gates `light_all` and `voyager` behind an API key and
 * answers unauthenticated requests with a ~2KB "API KEY REQUIRED"
 * watermark *at HTTP 200*, so a status check alone passes. A real 256px
 * raster tile is several KB. Used to reject an unusable template rather
 * than render a map covered in watermarks.
 */
const MIN_PLAUSIBLE_TILE_BYTES = 3072;

/** Substitutes Leaflet's placeholders for one known tile. */
function probeTileUrl(template: string): string {
  return template
    .replace("{s}", "a")
    .replace("{z}", "11")
    .replace("{x}", "1482")
    .replace("{y}", "929")
    .replace("{r}", "");
}

/**
 * Confirms the template actually serves imagery.
 *
 * `GET /map/config` currently advertises a CartoDB light_all template
 * that needs a CARTO API key this project does not have, so every tile
 * resolves to an "API KEY REQUIRED" watermark. Aborts quickly, and any
 * failure is treated as unusable — worst case is a short wait before
 * falling back to OpenStreetMap.
 */
async function templateServesTiles(template: string): Promise<boolean> {
  try {
    const res = await fetch(probeTileUrl(template), {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    return (await res.arrayBuffer()).byteLength >= MIN_PLAUSIBLE_TILE_BYTES;
  } catch {
    return false;
  }
}

/**
 * Server-controlled basemap config, falling back to the build-time env
 * var and then OpenStreetMap.
 *
 * Fetched relative so it resolves through the same-origin rewrite in
 * next.config.js, which proxies /api/v1/* to the EC2 backend. An
 * absolute URL would be blocked as mixed content, since the site is
 * served over HTTPS and the backend is not.
 *
 * Starts on the fallback so tiles paint immediately, then upgrades only
 * once a probe confirms the configured template serves real tiles.
 */
export function useMapConfig(): MapConfig {
  const [config, setConfig] = useState<MapConfig>(FALLBACK_MAP_CONFIG);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    fetch("/api/v1/map/config", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        if (cancelled || !isUsableTemplate(data?.tileUrlTemplate)) return;
        const next = {
          tileUrlTemplate: data.tileUrlTemplate,
          // An empty attribution string would strip required credit, so
          // fall back rather than serve tiles uncredited.
          attribution:
            typeof data.attribution === "string" && data.attribution.trim()
              ? data.attribution
              : FALLBACK_MAP_CONFIG.attribution,
          minZoom: Number.isFinite(data.minZoom)
            ? data.minZoom
            : FALLBACK_MAP_CONFIG.minZoom,
          maxZoom: Number.isFinite(data.maxZoom)
            ? data.maxZoom
            : FALLBACK_MAP_CONFIG.maxZoom,
        };
        // Only swap the basemap once a probe tile proves the template
        // serves real imagery rather than an API-key watermark.
        if (!(await templateServesTiles(next.tileUrlTemplate))) return;
        if (!cancelled) setConfig(next);
      })
      .catch(() => {
        /* keep the fallback basemap */
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return config;
}

/** True when the active source is a CARTO basemap, which needs extra credit. */
export function isCartoTemplate(template: string): boolean {
  return template.includes("basemaps.cartocdn.com");
}

export { OSM_TILE_URL, CARTO_TILE_URL, OSM_ATTRIBUTION };