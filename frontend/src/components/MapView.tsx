"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapBoundingBox, MapCluster, PublicPothole } from "@/types";
import "leaflet/dist/leaflet.css";
import { statusDivIcon, type PinStatus } from "@/components/macadam/MapSkin";
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/mapTiles";

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

/**
 * Frames the viewport on whatever was actually returned, used when the
 * caller supplies no explicit bounds.
 *
 * The admin console is the case this exists for: cluster scoping is done
 * correctly server-side, but the seeded district names post-date the
 * bundled location data (Eluru and Kakinada are still listed as mandals
 * under West/East Godavari). Resolving the viewport by name then lands on
 * the wrong box and the pins render off-screen. Fitting to the payload
 * sidesteps the naming mismatch entirely.
 */
function DataBoundsController({
  clusters,
  potholes,
}: {
  clusters: MapCluster[];
  potholes: PublicPothole[];
}) {
  const map = useMap();
  const points: [number, number][] = [
    ...clusters.map(
      (c) => [c.avg_latitude, c.avg_longitude] as [number, number]
    ),
    ...potholes.map((p) => [p.latitude, p.longitude] as [number, number]),
  ];
  const key = points.map((p) => p.join(",")).join("|");

  useEffect(() => {
    if (points.length === 0) return;
    const leafletBounds = L.latLngBounds(points);
    try {
      map.fitBounds(leafletBounds, { padding: [40, 40], animate: false, maxZoom: 15 });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);

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
        <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} />
        {bounds ? (
          <BoundsController bounds={bounds} />
        ) : (
          <DataBoundsController clusters={clusters} potholes={potholes} />
        )}
        {clusters.length > 0 && <ClusterMarkers clusters={clusters} />}
        {potholes.length > 0 && <PotholeMarkers potholes={potholes} />}
      </MapContainer>
    </div>
  );
}
