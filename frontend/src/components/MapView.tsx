"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { MapCluster } from "@/types";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const clusterIcon = L.divIcon({
  className: "bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg border-2 border-white",
  html: "<span></span>",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

interface MapViewProps {
  clusters: MapCluster[];
  center?: [number, number];
  zoom?: number;
}

function ClusterMarkers({ clusters }: { clusters: MapCluster[] }) {
  const map = useMap();

  useEffect(() => {
    if (clusters.length > 0) {
      const bounds = L.latLngBounds(
        clusters.map((c) => [c.avg_latitude, c.avg_longitude] as [number, number])
      );
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [clusters, map]);

  return (
    <>
      {clusters.map((cluster) => (
        <Marker
          key={cluster.block_id}
          position={[cluster.avg_latitude, cluster.avg_longitude]}
          icon={L.divIcon({
            className: "",
            html: `<div style="background:#2563eb;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${cluster.count}</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          })}
        >
          <Popup>
            <div className="text-sm">
              <strong>Block: {cluster.block_id}</strong>
              <br />
              Potholes: {cluster.count}
              <br />
              Est. Cost: ${(cluster.count * 150).toLocaleString()}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export default function MapView({ clusters, center = [20, 78], zoom = 5 }: MapViewProps) {
  return (
    <div className="h-[500px] w-full rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClusterMarkers clusters={clusters} />
      </MapContainer>
    </div>
  );
}
