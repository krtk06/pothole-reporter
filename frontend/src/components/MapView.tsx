"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { MapCluster, PublicPothole } from "@/types";
import { LatLngBounds } from "@/data/india-locations";
import "leaflet/dist/leaflet.css";

const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const STATUS_COLORS: Record<string, string> = {
  verified: "#22c55e",
  pending: "#f59e0b",
  rejected: "#ef4444",
  fixed: "#6366f1",
};

interface MapViewProps {
  clusters?: MapCluster[];
  potholes?: PublicPothole[];
  center?: [number, number];
  zoom?: number;
  bounds?: LatLngBounds | null;
}

function BoundsController({ bounds }: { bounds: LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    const leafletBounds = L.latLngBounds(
      [bounds.south, bounds.west],
      [bounds.north, bounds.east]
    );
    map.fitBounds(leafletBounds, { padding: [20, 20] });
    map.setMaxBounds(leafletBounds.pad(0.1));
  }, [bounds, map]);
  return null;
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
            html: `<div style="background:#ea580c;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${cluster.count}</div>`,
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
              Est. Cost: ₹{(cluster.count * 150).toLocaleString()}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function PotholeMarkers({ potholes }: { potholes: PublicPothole[] }) {
  return (
    <>
      {potholes.map((p) => {
        const color = STATUS_COLORS[p.status] || "#94a3b8";
        return (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={L.divIcon({
              className: "",
              html: `<div style="width:12px;height:12px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6],
            })}
          >
            <Popup>
              <div className="text-sm">
                <strong style={{ color }}>{p.status}</strong>
                <br />
                <span className="text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString()}</span>
                {p.block_id && <><br /><span className="font-mono text-xs text-gray-400">{p.block_id}</span></>}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export default function MapView({
  clusters = [],
  potholes = [],
  center = [20, 78],
  zoom = 5,
  bounds,
}: MapViewProps) {
  return (
    <div className="h-[500px] w-full rounded-lg overflow-hidden border border-[var(--color-border)]">
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        zoomControl={true}
        maxBoundsViscosity={bounds ? 0.9 : undefined}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {bounds && <BoundsController bounds={bounds} />}
        {clusters.length > 0 && <ClusterMarkers clusters={clusters} />}
        {potholes.length > 0 && <PotholeMarkers potholes={potholes} />}
      </MapContainer>
    </div>
  );
}
