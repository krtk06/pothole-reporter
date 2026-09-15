"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { MapBoundingBox, PublicPothole } from "@/types";
import { statusDivIcon, type PinStatus } from "@/components/macadam/MapSkin";

interface PublicMiniMapProps {
  potholes: PublicPothole[];
  userPotholes?: PublicPothole[];
  bounds?: MapBoundingBox | null;
  boundary?: unknown | null;
  height?: number | string;
  center?: [number, number];
  zoom?: number;
}

const STATUS_PIN: Record<string, PinStatus> = {
  verified: "open",
  pending: "under_review",
  rejected: "rejected",
  fixed: "assigned",
};

const STATUS_VAR: Record<string, string> = {
  verified: "var(--ok)",
  pending: "var(--warn)",
  rejected: "var(--bad)",
  fixed: "var(--info)",
};

const STATUS_LABELS: Record<string, string> = {
  verified: "Accepted",
  pending: "Reported",
  rejected: "Rejected",
  fixed: "Fixed",
};

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export default function PublicMiniMap({
  potholes,
  userPotholes = [],
  bounds,
  boundary,
  height = 300,
  center = [15.9, 80.5],
  zoom = 7,
}: PublicMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if ((container as any)._leaflet_id) return;

    let cancelled = false;

    const init = async () => {
      const L = await import("leaflet");
      if (cancelled || !container || (container as any)._leaflet_id) return;

      if (L && L.DomUtil && !(L.DomUtil as any)._patched_pos) {
        (L.DomUtil as any)._patched_pos = true;
        const origGetPos = L.DomUtil.getPosition;
        L.DomUtil.getPosition = function (el: any) {
          if (!el) return new L.Point(0, 0);
          try {
            return origGetPos ? origGetPos.call(L.DomUtil, el) : (el._leaflet_pos || new L.Point(0, 0));
          } catch {
            return el?._leaflet_pos || new L.Point(0, 0);
          }
        };
      }

      let initialCenter: [number, number] = center;
      const initialZoom = zoom;

      if (bounds) {
        const midLat = (bounds.north + bounds.south) / 2;
        const midLng = (bounds.east + bounds.west) / 2;
        initialCenter = [midLat, midLng];
      }

      const map = L.map(container, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false,
        zoomAnimation: false,
        minZoom: 7,
        maxZoom: 18,
      }).setView(initialCenter, initialZoom);

      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
      }).addTo(map);

      if (bounds) {
        const leafletBounds = L.latLngBounds(
          [bounds.south, bounds.west],
          [bounds.north, bounds.east]
        );
        map.fitBounds(leafletBounds, { padding: [10, 10] });
        map.setMaxBounds(leafletBounds.pad(0.1));
      }

      if (boundary && typeof boundary === "object" && "type" in boundary) {
        const boundaryColor = cssVar("--accent-2", "#5b6cff");
        L.geoJSON(boundary as any, {
          style: {
            color: boundaryColor,
            weight: 2,
            opacity: 0.75,
            fillColor: boundaryColor,
            fillOpacity: 0.08,
          },
        }).addTo(map);
      }

      const allPotholes = [...potholes, ...userPotholes];

      for (const p of allPotholes) {
        const status = STATUS_PIN[p.status] || "reported";
        const colorVar = STATUS_VAR[p.status] || "var(--text-3)";
        const label = STATUS_LABELS[p.status] || p.status;
        const isUser = userPotholes.some((u) => u.id === p.id);

        const icon = statusDivIcon(status, { selected: isUser });

        L.marker([p.latitude, p.longitude], { icon })
          .bindPopup(
            `<div style="font-size:12px;min-width:130px;display:grid;gap:3px;">
              <strong style="color:${colorVar};font-weight:600;">${label}</strong>
              <span style="color:var(--text-3);">${new Date(p.created_at).toLocaleDateString()}</span>
              ${
                p.block_id
                  ? `<span style="font-family:var(--font-mono),monospace;font-size:11px;color:var(--text-2);">${p.block_id}</span>`
                  : ""
              }
              ${isUser ? `<span style="color:var(--accent-2);font-size:11px;">Your report</span>` : ""}
            </div>`
          )
          .addTo(map);
      }

      if (!bounds && allPotholes.length > 0) {
        const pts = allPotholes.map((p) => [p.latitude, p.longitude] as [number, number]);
        const autoBounds = L.latLngBounds(pts);
        if (autoBounds.isValid()) {
          map.fitBounds(autoBounds, { padding: [30, 30] });
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ height, position: "relative" }} className="macadam-map w-full overflow-hidden">
      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-3 rounded-lg border border-hairline bg-surface/95 px-3 py-2 shadow-2">
        {Object.entries(STATUS_PIN).map(([status, pin]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`macadam-pin macadam-pin--${pin} !h-2 !w-2 !shadow-none`} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink2">
              {STATUS_LABELS[status]}
            </span>
          </div>
        ))}
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
