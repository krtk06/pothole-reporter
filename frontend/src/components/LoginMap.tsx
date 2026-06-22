"use client";

import { useEffect, useRef } from "react";

export default function LoginMap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Prevent double init in StrictMode
    if ((container as any)._leaflet_id) return;

    let mapInstance: any = null;

    const init = async () => {
      const L = await import("leaflet");
      if (!container || (container as any)._leaflet_id) return;

      const defaultPos: [number, number] = [20.5937, 78.9629];
      mapInstance = L.map(container, { zoomControl: false, attributionControl: false }).setView(defaultPos, 5);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapInstance);

      const greenIcon = L.divIcon({
        className: "",
        html: `<div style="width:20px;height:20px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 0 20px rgba(34,197,94,0.6);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      L.marker(defaultPos, { icon: greenIcon }).addTo(mapInstance).bindPopup("India — default location");

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            mapInstance.setView([lat, lng], 12, { animate: true });
            const userIcon = L.divIcon({
              className: "",
              html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 20px rgba(59,130,246,0.8);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });
            L.marker([lat, lng], { icon: userIcon }).addTo(mapInstance).bindPopup("Your location");
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    };

    init();
    return () => { mapInstance?.remove(); };
  }, []);

  return <div ref={containerRef} className="w-full h-full absolute inset-0" />;
}
