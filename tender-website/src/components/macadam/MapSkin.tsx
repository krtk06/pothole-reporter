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
