import type { MapBoundingBox } from "@/types";
import {
  getDistrictBounds,
  getStateBounds,
  INDIA_LOCATIONS,
} from "@/data/india-locations";

/**
 * Resolve a viewport for a selected administrative location.
 *
 * The backend's `GET /map/areas/current` only answers for a caller that
 * already supplies `latitude`/`longitude`; a village/mandal id returns
 * 400. `andhraDirectory.json` carries codes but no geometry, so neither
 * side can turn a selection into coordinates on its own.
 *
 * `india-locations.ts` does carry bounding boxes, so the viewport is
 * resolved here instead. Mandal and village selections inherit their
 * district's box, which keeps the map on the right part of the state
 * without inventing coordinates that aren't in the source data.
 *
 * Returns null when nothing matches, so callers can decide whether to
 * widen the search or surface an error — rather than silently falling
 * back to a box somewhere else entirely.
 */
export function resolveViewport(input: {
  state?: string | null;
  district?: string | null;
  mandal?: string | null;
}): MapBoundingBox | null {
  const state = (input.state || "Andhra Pradesh").trim();

  // Deliberately not using getMandalBounds(): it splits a district into an
  // even grid by list index, which is a guess rather than real geography.
  // For Eluru that lands on 17.1-17.4N while the actual reports sit at
  // 16.3-16.5N. Showing the parent district is honest and keeps pins on
  // screen.
  if (input.district) {
    const district = getDistrictBounds(state, input.district);
    if (district) return district;

    // The 2022 reorganisation split West Godavari into Eluru, and
    // Kakinada out of East Godavari, but this dataset predates it and
    // still lists both as mandals. Seeded admins carry the new district
    // names, so resolve them via whichever district now owns the mandal
    // rather than dropping the viewport to the whole state.
    const viaMandal = getDistrictBounds(state, districtOwningMandal(state, input.district));
    if (viaMandal) return viaMandal;
  }

  if (input.mandal) {
    const viaMandal = getDistrictBounds(state, districtOwningMandal(state, input.mandal));
    if (viaMandal) return viaMandal;
  }

  return getStateBounds(state);
}

/** Name of the district that lists `mandalName` among its mandals. */
function districtOwningMandal(stateName: string, mandalName: string): string {
  const state = INDIA_LOCATIONS.find((s) => s.name === stateName);
  if (!state) return mandalName;
  const owner = state.districts.find((d) => d.mandals.includes(mandalName));
  return owner ? owner.name : mandalName;
}

/** Centre point of a viewport, for maps that want a single coordinate. */
export function viewportCentre(box: MapBoundingBox): {
  latitude: number;
  longitude: number;
} {
  return {
    latitude: (box.north + box.south) / 2,
    longitude: (box.east + box.west) / 2,
  };
}