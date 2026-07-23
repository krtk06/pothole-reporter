"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { PublicPothole } from "@/types";
import { LatLngBounds } from "@/data/india-locations";

interface PublicMiniMapProps {
  potholes: PublicPothole[];
  userPotholes?: PublicPothole[];
  bounds?: LatLngBounds | null;
  height?: number | string;
  center?: [number, number];
  zoom?: number;
}

const STATUS_COLORS: Record<string, string> = {
  verified: "#22c55e",   // green
  pending: "#f59e0b",    // amber
  rejected: "#ef4444",   // red
  fixed: "#6366f1",      // indigo
};

const STATUS_LABELS: Record<string, string> = {
  verified: "Accepted",
  pending: "Reported",
  rejected: "Rejected",
  fixed: "Fixed",
};

export default function PublicMiniMap({
  potholes,
  userPotholes = [],
  bounds,
  height = 300,
  center = [20, 78],
  zoom = 5,
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

      // Compute initial view from bounds if provided
      let initialCenter: [number, number] = center;
      let initialZoom = zoom;

      if (bounds) {
        const midLat = (bounds.north + bounds.south) / 2;
        const midLng = (bounds.east + bounds.west) / 2;
        initialCenter = [midLat, midLng];
      }

      const map = L.map(container, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false,
      }).setView(initialCenter, initialZoom);

      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
      }).addTo(map);

      // Apply bounds restriction if provided
      if (bounds) {
        const leafletBounds = L.latLngBounds(
          [bounds.south, bounds.west],
          [bounds.north, bounds.east]
        );
        map.fitBounds(leafletBounds, { padding: [10, 10] });
        map.setMaxBounds(leafletBounds.pad(0.1));
      }

      // Add all potholes to map
      const allPotholes = [...potholes, ...userPotholes];
      const markers: L.Layer[] = [];

      for (const p of allPotholes) {
        const color = STATUS_COLORS[p.status] || "#94a3b8";
        const label = STATUS_LABELS[p.status] || p.status;
        const isUser = userPotholes.some((u) => u.id === p.id);

        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:${isUser ? 14 : 12}px;
            height:${isUser ? 14 : 12}px;
            background:${color};
            border:${isUser ? "3px solid white" : "2px solid rgba(255,255,255,0.8)"};
            border-radius:50%;
            box-shadow:0 1px 4px rgba(0,0,0,0.4);
            ${isUser ? "outline: 2px solid " + color + ";" : ""}
          "></div>`,
          iconSize: [isUser ? 14 : 12, isUser ? 14 : 12],
          iconAnchor: [isUser ? 7 : 6, isUser ? 7 : 6],
        });

        const marker = L.marker([p.latitude, p.longitude], { icon })
          .bindPopup(`
            <div style="font-size:12px;min-width:120px;">
              <strong style="color:${color}">${label}</strong><br/>
              <span style="color:#888;">
                ${new Date(p.created_at).toLocaleDateString()}
              </span>
              ${p.block_id ? `<br/><span style="font-family:monospace;font-size:11px;color:#aaa;">${p.block_id}</span>` : ""}
              ${isUser ? `<br/><span style="color:#60a5fa;font-size:11px;">📍 Your report</span>` : ""}
            </div>
          `)
          .addTo(map);
        markers.push(marker);
      }

      // Auto-fit to pothole markers if no bounds given
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
    <div
      style={{ height, position: "relative" }}
      className="w-full rounded-xl overflow-hidden border border-[var(--color-border)]"
    >
      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-2 bg-[var(--color-surface)]/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-[var(--color-border)] shadow-lg">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div
              style={{ width: 8, height: 8, borderRadius: "50%", background: color, border: "1.5px solid rgba(255,255,255,0.6)" }}
            />
            <span className="text-[10px] text-[var(--color-text-secondary)] capitalize">
              {STATUS_LABELS[status]}
            </span>
          </div>
        ))}
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
