"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

export default function LoginMap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if ((container as any)._leaflet_id) return;

    let mapInstance: LeafletMap | null = null;
    let cancelled = false;

    const init = async () => {
      const L = await import("leaflet");
      if (cancelled || !container || (container as any)._leaflet_id) return;

      const fallbackPos: [number, number] = [20, 0];
      let initialPos: [number, number] = fallbackPos;
      let initialZoom = 2;

      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
            });
          });
          initialPos = [pos.coords.latitude, pos.coords.longitude];
          initialZoom = 12;
        } catch {
        }
      }

      if (cancelled) return;

      mapInstance = L.map(container, { zoomControl: false, attributionControl: false }).setView(initialPos, initialZoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapInstance);

      const userIcon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 20px rgba(59,130,246,0.8);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker(initialPos, { icon: userIcon }).addTo(mapInstance).bindPopup("Your location");
    };

    init();
    return () => { cancelled = true; mapInstance?.remove(); };
  }, []);

  return <div ref={containerRef} className="w-full h-full absolute inset-0" />;
}
