"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapBoundingBox, MapCluster, PublicPothole } from "@/types";
import "leaflet/dist/leaflet.css";
import { statusDivIcon, type PinStatus } from "@/components/macadam/MapSkin";

const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

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

interface MapViewProps {
  clusters?: MapCluster[];
  potholes?: PublicPothole[];
  center?: [number, number];
  zoom?: number;
  bounds?: MapBoundingBox | null;
}

function BoundsController({ bounds }: { bounds: MapBoundingBox }) {
  const map = useMap();
  useEffect(() => {
    const leafletBounds = L.latLngBounds(
      [bounds.south, bounds.west],
      [bounds.north, bounds.east]
    );
    try {
      map.fitBounds(leafletBounds, { padding: [20, 20], animate: false });
      map.setMaxBounds(leafletBounds.pad(0.1));
    } catch {}
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
        try {
          map.fitBounds(bounds, { padding: [50, 50], animate: false });
        } catch {}
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
            className: "macadam-cluster-wrap",
            html: `<span class="macadam-cluster">${cluster.count}</span>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })}
        >
          <Popup>
            <div style={{ display: "grid", gap: 3 }}>
              <strong style={{ fontFamily: "var(--font-mono), monospace" }}>{cluster.block_id}</strong>
              <span style={{ color: "var(--text-2)" }}>Potholes: {cluster.count}</span>
              <span style={{ color: "var(--text-2)" }}>
                Est. cost: ₹{(cluster.count * 150).toLocaleString("en-IN")}
              </span>
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
        const colorVar = STATUS_VAR[p.status] || "var(--text-3)";
        const label = STATUS_LABELS[p.status] || p.status;
        return (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={statusDivIcon(STATUS_PIN[p.status] || "reported")}
          >
            <Popup>
              <div style={{ display: "grid", gap: 3 }}>
                <strong style={{ color: colorVar }}>{label}</strong>
                <span style={{ color: "var(--text-3)" }}>
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
                {p.block_id && (
                  <span style={{ fontFamily: "var(--font-mono), monospace", color: "var(--text-2)" }}>
                    {p.block_id}
                  </span>
                )}
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
    <div className="macadam-map h-[460px] w-full sm:h-[520px]">
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={7}
        maxZoom={18}
        className="h-full w-full"
        zoomControl={true}
        zoomAnimation={false}
        maxBoundsViscosity={bounds ? 0.9 : undefined}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        {bounds && <BoundsController bounds={bounds} />}
        {clusters.length > 0 && <ClusterMarkers clusters={clusters} />}
        {potholes.length > 0 && <PotholeMarkers potholes={potholes} />}
      </MapContainer>
    </div>
  );
}
