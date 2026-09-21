"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { Pothole } from "@/lib/tenderStore";

const PIN_FOR_STATUS: Record<string, string> = {
  open: "open",
  under_review: "under_review",
  assigned: "assigned",
  completed: "completed",
  rejected: "rejected",
  verified: "open",
  pending: "under_review",
  fixed: "assigned",
};

function pinIcon(status?: string) {
  const pin = PIN_FOR_STATUS[status || "open"] || "reported";
  return new L.DivIcon({
    className: "macadam-pin-wrap",
    html: `<span class="macadam-pin macadam-pin--${pin}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -11],
  });
}

// Guard against unmounted pane position errors (_leaflet_pos)
if (typeof window !== "undefined" && L && L.DomUtil) {
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

function MapRecenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    try {
      map.setView(center, zoom, { animate: false });
    } catch {}
  }, [center, zoom, map]);
  return null;
}

interface TenderMapProps {
  potholes: Pothole[];
  height?: string;
  zoom?: number;
  initialCenter?: [number, number];
}

export default function TenderMap({
  potholes,
  height = "420px",
  zoom = 12,
  initialCenter,
}: TenderMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{ height }}
        className="flex w-full animate-pulse items-center justify-center rounded-xl border border-hairline bg-sunken text-xs text-ink3"
      >
        Loading interactive map…
      </div>
    );
  }

  const validPotholes = potholes.filter(
    (p) => !isNaN(p.latitude) && !isNaN(p.longitude) && p.latitude !== 0 && p.longitude !== 0
  );

  let center: [number, number] = initialCenter || [16.5062, 80.648];

  if (!initialCenter && validPotholes.length > 0) {
    const avgLat = validPotholes.reduce((sum, p) => sum + p.latitude, 0) / validPotholes.length;
    const avgLng = validPotholes.reduce((sum, p) => sum + p.longitude, 0) / validPotholes.length;
    center = [avgLat, avgLng];
  }

  const resolvedZoom = validPotholes.length > 1 ? 11 : zoom;

  return (
    <div style={{ height }} className="macadam-map relative z-0 w-full overflow-hidden">
      <MapContainer
        center={center}
        zoom={resolvedZoom}
        scrollWheelZoom={false}
        zoomAnimation={false}
        style={{ height: "100%", width: "100%" }}
      >
        <MapRecenter center={center} zoom={resolvedZoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        {validPotholes.map((p) => (
          <Marker key={p.id} position={[p.latitude, p.longitude]} icon={pinIcon(p.status)}>
            <Popup>
              <div style={{ display: "grid", gap: 4, maxWidth: 260 }}>
                {p.image_url && (
                  <div
                    style={{
                      overflow: "hidden",
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      aspectRatio: "16 / 9",
                    }}
                  >
                    <img
                      src={p.image_url}
                      alt="Pothole evidence"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 12, color: "var(--text)" }}>
                    Pothole evidence
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono), monospace",
                      color: "var(--accent-2)",
                      border: "1px solid var(--line)",
                      borderRadius: 999,
                      padding: "1px 6px",
                    }}
                  >
                    {p.status}
                  </span>
                </div>
                {p.address_notes && (
                  <p style={{ fontSize: 11, color: "var(--text-2)", margin: 0 }}>{p.address_notes}</p>
                )}
                <p style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace", color: "var(--text-3)", margin: 0 }}>
                  GPS: {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                </p>
                {p.block_id && (
                  <p style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace", color: "var(--text-3)", margin: 0 }}>
                    Block: {p.block_id}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
