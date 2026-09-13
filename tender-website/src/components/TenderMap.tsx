"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { Pothole } from "@/lib/tenderStore";

// Configure default Leaflet icon using data URIs to avoid missing asset issues in SSR
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

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
        className="w-full rounded-xl bg-slate-900 animate-pulse border border-slate-800 flex items-center justify-center text-slate-500 text-xs"
      >
        Loading interactive map...
      </div>
    );
  }

  const validPotholes = potholes.filter(
    (p) => !isNaN(p.latitude) && !isNaN(p.longitude) && p.latitude !== 0 && p.longitude !== 0
  );

  let center: [number, number] = initialCenter || [16.5062, 80.648]; // default Vijayawada center

  if (!initialCenter && validPotholes.length > 0) {
    const avgLat = validPotholes.reduce((sum, p) => sum + p.latitude, 0) / validPotholes.length;
    const avgLng = validPotholes.reduce((sum, p) => sum + p.longitude, 0) / validPotholes.length;
    center = [avgLat, avgLng];
  }

  return (
    <div style={{ height }} className="w-full rounded-xl overflow-hidden border border-slate-800 relative z-0">
      <MapContainer
        center={center}
        zoom={validPotholes.length > 1 ? 11 : zoom}
        scrollWheelZoom={false}
        zoomAnimation={false}
        style={{ height: "100%", width: "100%" }}
      >
        <MapRecenter center={center} zoom={validPotholes.length > 1 ? 11 : zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validPotholes.map((p) => (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={markerIcon}
          >
            <Popup>
              <div className="p-1 max-w-xs text-slate-100">
                {p.image_url && (
                  <div className="mb-2 rounded overflow-hidden bg-slate-800 aspect-video relative">
                    <img
                      src={p.image_url}
                      alt="Pothole evidence"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-xs text-amber-400">Pothole Evidence</span>
                  <span className="text-[10px] bg-green-900/60 text-green-300 border border-green-700/50 px-1.5 py-0.5 rounded font-mono">
                    {p.status}
                  </span>
                </div>
                {p.address_notes && (
                  <p className="text-[11px] text-slate-300 mb-1.5 line-clamp-3">
                    {p.address_notes}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 font-mono">
                  GPS: {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                </p>
                {p.block_id && (
                  <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
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
