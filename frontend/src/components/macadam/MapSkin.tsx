import L from "leaflet";

export type PinStatus =
  | "reported"
  | "open"
  | "under_review"
  | "assigned"
  | "completed"
  | "rejected";

const STATUS_CLASS: Record<PinStatus, string> = {
  reported: "macadam-pin--reported",
  open: "macadam-pin--open",
  under_review: "macadam-pin--under_review",
  assigned: "macadam-pin--assigned",
  completed: "macadam-pin--completed",
  rejected: "macadam-pin--rejected",
};

export interface StatusIconOptions {
  selected?: boolean;
  count?: number;
}

/** A single status pin, optionally with a count badge and a sonar ring. */
export function statusDivIcon(status: PinStatus, options: StatusIconOptions = {}) {
  const { selected = false, count } = options;
  const badge = count != null ? `<span class="macadam-pin-count">${count}</span>` : "";
  const sonar = selected ? '<span class="macadam-sonar"></span>' : "";
  return L.divIcon({
    className: "macadam-pin-wrap",
    html: `<span class="macadam-pin ${STATUS_CLASS[status]}${selected ? " is-selected" : ""}">${badge}${sonar}</span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -11],
  });
}

/**
 * Density bands for block-cluster markers.
 *
 * Deliberately not traffic-light green/yellow/red — that reads as a
 * generic status light and clashes with the MACADAM palette. The scale
 * runs quiet indigo → amber → ember so it stays inside the existing
 * token set and still separates low from high at a glance.
 *
 * Thresholds follow the handover's suggested bands (green <5,
 * yellow 5–15, red >15) mapped onto those three tones.
 */
export type DensityBand = "low" | "moderate" | "high";

const DENSITY_CLASS: Record<DensityBand, string> = {
  low: "macadam-cluster--low",
  moderate: "macadam-cluster--moderate",
  high: "macadam-cluster--high",
};

export function densityBand(count: number): DensityBand {
  if (count >= 15) return "high";
  if (count >= 5) return "moderate";
  return "low";
}

/** Block cluster marker, tinted by how many potholes the block holds. */
export function densityDivIcon(count: number) {
  const band = densityBand(count);
  return L.divIcon({
    className: "macadam-cluster-wrap",
    html: `<span class="macadam-cluster ${DENSITY_CLASS[band]}">${count}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

/** A neutral survey marker for non-status points (e.g. area centroids). */
export function neutralDivIcon(label?: string) {
  return L.divIcon({
    className: "macadam-pin-wrap",
    html: `<span class="macadam-pin macadam-pin--neutral">${
      label ? `<span class="macadam-pin-count">${label}</span>` : ""
    }</span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -11],
  });
}

export const MAP_SKIN_CLASS = "macadam-map";
