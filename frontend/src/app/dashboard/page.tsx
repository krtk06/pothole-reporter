"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { PublicPothole, type AdministrativeArea, type MapBoundingBox } from "@/types";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import AndhraLocationSelector, { type AndhraLocationSelection } from "@/components/AndhraLocationSelector";
import { ANDHRA_STATE } from "@/data/andhraDirectory";
import DotPager from "@/components/pixel/DotPager";
import PixelIcon from "@/components/pixel/PixelIcon";
import PixelSprite from "@/components/pixel/PixelSprite";
import BrandLogo from "@/components/pixel/BrandLogo";
import {
  PixelWindow,
  PixelButton,
  PixelLamp,
  PixelChip,
} from "@/components/pixel/PixelUI";

const PublicMiniMap = dynamic(() => import("@/components/PublicMiniMap"), { ssr: false });

function areaBounds(area: AdministrativeArea | null): MapBoundingBox | null {
  if (area?.bbox) return area.bbox;
  if (area?.latitude && area.longitude) {
    return {
      north: area.latitude + 0.0045,
      south: area.latitude - 0.0045,
      east: area.longitude + 0.0045,
      west: area.longitude - 0.0045,
    };
  }
  return null;
}

function selectionFromArea(area: AdministrativeArea | null): AndhraLocationSelection {
  if (!area) {
    return { district: null, subdistrict: null, village: null };
  }

  const district = area.districtCode && area.districtName
    ? {
        id: `district:${area.districtCode}`,
        name: area.districtName,
        displayName: `${area.districtName}, Andhra Pradesh, India`,
        type: "district" as const,
        stateCode: area.stateCode,
        stateName: area.stateName,
        districtCode: area.districtCode,
        districtName: area.districtName,
      }
    : null;

  const subdistrict = area.subdistrictCode && area.subdistrictName
    ? {
        id: `subdistrict:${area.subdistrictCode}`,
        name: area.subdistrictName,
        displayName: `${area.subdistrictName}, ${area.districtName || ""}, Andhra Pradesh, India`,
        type: "subdistrict" as const,
        stateCode: area.stateCode,
        stateName: area.stateName,
        districtCode: area.districtCode,
        districtName: area.districtName,
        subdistrictCode: area.subdistrictCode,
        subdistrictName: area.subdistrictName,
      }
    : null;

  return {
    district,
    subdistrict,
    village: area.type === "village" ? area : null,
  };
}

export default function Dashboard() {
  const { user, logout, selectedArea, setAdministrativeArea } = useStore();
  const router = useRouter();
  const [potholes, setPotholes] = useState<PublicPothole[]>([]);
  const [loadingMap, setLoadingMap] = useState(false);
  const [resolvingArea, setResolvingArea] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [area, setArea] = useState<AdministrativeArea | null>(selectedArea);
  const [locationSelection, setLocationSelection] = useState<AndhraLocationSelection>(
    selectionFromArea(selectedArea)
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "admin") {
      router.replace("/admin");
    }
  }, [mounted, router, user]);

  useEffect(() => {
    if (!selectedArea) return;
    setArea(selectedArea);
  }, [selectedArea]);

  const scopedBounds = useMemo(() => areaBounds(area), [area]);
  const locationLabel = area?.displayName || "Select District, Mandal, City/Village";

  const fetchPotholes = async () => {
    if (!scopedBounds) {
      setPotholes([]);
      return;
    }

    setLoadingMap(true);
    setError("");
    try {
      const data = await api.getPotholesInBounds(scopedBounds);
      setPotholes(data.potholes || []);
    } catch (err: any) {
      setError(err.message || "Unable to load map data");
    } finally {
      setLoadingMap(false);
    }
  };

  useEffect(() => {
    if (!user || user.role === "admin") return;
    void fetchPotholes();
  }, [user, scopedBounds?.north, scopedBounds?.south, scopedBounds?.east, scopedBounds?.west]);

  async function handleLocationChange(next: AndhraLocationSelection) {
    setLocationSelection(next);
    setError("");

    if (!next.village) {
      setArea(null);
      setPotholes([]);
      return;
    }

    if (area?.id === next.village.id) {
      return;
    }

    setResolvingArea(true);
    try {
      const { area: resolved } = await api.getCurrentAdministrativeArea(next.village);
      setArea(resolved);
      setAdministrativeArea(resolved);
    } catch (err: any) {
      setError(err.message || "Unable to resolve the selected city/village.");
    } finally {
      setResolvingArea(false);
    }
  }

  if (!mounted || !user || user.role === "admin") return null;

  const stats = {
    total: potholes.length,
    pending: potholes.filter((p) => p.status === "pending").length,
    verified: potholes.filter((p) => p.status === "verified").length,
    fixed: potholes.filter((p) => p.status === "fixed").length,
  };

  const statItems = [
    { label: "Total", value: stats.total },
    { label: "Reported", value: stats.pending },
    { label: "Accepted", value: stats.verified },
    { label: "Fixed", value: stats.fixed },
  ];

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <header className="px-titlebar flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <a href="/dashboard" className="flex min-w-0 items-center gap-2">
          <BrandLogo
            src="/brand/pothole-reporter.png"
            alt="Pothole Reporter"
            size={32}
            fallback={
              <span className="px-bevel flex h-6 w-6 shrink-0 items-center justify-center bg-[var(--px-panel)] text-[var(--px-text)]">
                <PixelSprite name="worker" size={16} alt="Pothole Reporter" />
              </span>
            }
          />
          <span className="font-pixel truncate text-[10px]">Pothole Reporter</span>
        </a>
        <div className="flex min-w-0 items-center gap-2">
          {area && (
            <PixelChip className="hidden min-w-0 sm:inline-flex">
              <PixelIcon name="pin" size={10} />
              <span className="truncate">{area.name}</span>
            </PixelChip>
          )}
          <span className="ledger hidden text-[var(--px-on-accent)] sm:block">Guest</span>
          <ThemeToggle />
          <PixelButton
            variant="red"
            icon="close"
            onClick={() => { void logout().finally(() => router.push("/login")); }}
          >
            Exit
          </PixelButton>
        </div>
      </header>

      <DotPager
        className="flex-1 min-h-0"
        ariaLabel="Dashboard sections"
        pages={[
          { id: "status", label: "Status" },
          { id: "map", label: "Map" },
        ]}
      >
        {/* Panel 1 — STATUS */}
        <div className="px-scroll h-full overflow-y-auto p-3 md:p-4">
          <div className="mx-auto grid max-w-3xl gap-4">
            <PixelWindow title="Area Filter" icon="filter" bodyClassName="p-4">
              <AndhraLocationSelector
                value={locationSelection}
                onChange={handleLocationChange}
                label={false}
              />
              {resolvingArea && (
                <p className="mt-4 flex items-center gap-2 text-sm text-dim">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Resolving selected city/village...
                </p>
              )}
              {!area && !resolvingArea && (
                <p className="mt-4 text-sm text-orange">
                  Choose district, mandal, and city/village to load the scoped map.
                </p>
              )}
              {error && <p className="mt-4 text-sm text-red">{error}</p>}
            </PixelWindow>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statItems.map((item) => (
                <PixelWindow key={item.label} title={item.label} bodyClassName="p-3">
                  <p className="font-pixel tnum text-lg">{item.value}</p>
                </PixelWindow>
              ))}
            </div>

            <PixelWindow title="Map Legend" icon="map" bodyClassName="flex flex-wrap gap-2 p-4">
              <PixelChip>
                <PixelLamp status="open" />
                Accepted
              </PixelChip>
              <PixelChip>
                <PixelLamp status="review" />
                Reported
              </PixelChip>
              <PixelChip>
                <PixelLamp status="done" className="!bg-red" />
                Rejected
              </PixelChip>
              <PixelChip>
                <PixelLamp status="assigned" />
                Fixed
              </PixelChip>
            </PixelWindow>
          </div>
        </div>

        {/* Panel 2 — MAP */}
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-pixel text-[10px] truncate">
                <PixelIcon name="map" size={12} />
                {area?.name || "Select Area"}
              </h2>
              <p className="ledger truncate text-dim">
                {area ? `Map is scoped to ${locationLabel}` : "No area selected"}
              </p>
            </div>
            <PixelButton
              icon="search"
              onClick={fetchPotholes}
              disabled={loadingMap || !scopedBounds}
            >
              {loadingMap ? "Loading" : "Refresh"}
            </PixelButton>
          </div>

          <div className="min-h-0 flex-1 px-3 pb-3">
            <div className="h-full">
              {loadingMap ? (
                <div className="px-well flex h-full items-center justify-center">
                  <span className="ledger flex items-center gap-2 text-dim">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading map data...
                  </span>
                </div>
              ) : (
                <PublicMiniMap
                  key={`${area?.id || "andhra"}-${potholes.length}`}
                  potholes={potholes}
                  bounds={scopedBounds || ANDHRA_STATE.bbox}
                  boundary={area?.boundary || null}
                  height="100%"
                  center={area?.latitude && area.longitude ? [area.latitude, area.longitude] : undefined}
                  zoom={area ? 13 : 7}
                />
              )}
            </div>
          </div>
        </div>
      </DotPager>
    </div>
  );
}
