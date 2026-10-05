/**
 * Map tile source.
 *
 * Defaults to OpenStreetMap standard raster tiles. Set
 * NEXT_PUBLIC_MAP_TILE_URL at BUILD time to swap the basemap — the
 * CartoDB Voyager layer is a drop-in alternative:
 *
 *   https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png
 *
 * `{s}` (subdomain) and `{r}` (retina) are substituted by Leaflet, so a
 * Carto URL can be pasted in verbatim.
 *
 * Attribution is not optional: every source below is derived from
 * OpenStreetMap data, so credit is a licence requirement regardless of
 * which provider serves the tiles.
 */

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const CARTO_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

export const MAP_TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL || OSM_TILE_URL;

export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' +
  (MAP_TILE_URL === OSM_TILE_URL ? "" : ' &copy; <a href="https://carto.com/attributions">CARTO</a>');

/** True when the configured source is the CartoDB basemap. */
export const IS_CARTO = MAP_TILE_URL === CARTO_TILE_URL;