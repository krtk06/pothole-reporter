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

      const fallbackPos: [number, number] = [15.9, 80.5];
      let initialPos: [number, number] = fallbackPos;
      let initialZoom = 7;

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
        className: "macadam-pin-wrap",
        html: `<span class="macadam-pin macadam-pin--neutral is-selected"><span class="macadam-sonar"></span></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker(initialPos, { icon: userIcon }).addTo(mapInstance).bindPopup("Your location");
    };

    init();
    return () => { cancelled = true; mapInstance?.remove(); };
  }, []);

  return <div ref={containerRef} className="w-full h-full absolute inset-0" />;
}
