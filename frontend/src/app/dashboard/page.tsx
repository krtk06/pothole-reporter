"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2, LogOut, Map, MapPin, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { PublicPothole, type AdministrativeArea, type MapBoundingBox } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import AndhraLocationSelector, { type AndhraLocationSelection } from "@/components/AndhraLocationSelector";
import { ANDHRA_STATE } from "@/data/andhraDirectory";

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
    setLocationSelection(selectionFromArea(selectedArea));
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
      setAdministrativeArea(null);
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

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <nav className="flex items-center justify-between p-4 md:px-16 lg:px-24 xl:px-32 md:py-6 w-full border-b border-[var(--color-border)]">
        <a className="flex items-center gap-2" href="/dashboard">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-text-primary)] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--color-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-bold text-[var(--color-heading)]">Pothole Reporter</span>
        </a>
        <div className="flex items-center gap-3">
          {area && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-full px-3 py-1">
              <MapPin className="w-3 h-3" />
              {area.name}
            </div>
          )}
          <span className="text-sm text-[var(--color-text-secondary)] hidden sm:block">Guest</span>
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => { void logout().finally(() => router.push("/login")); }} className="text-[var(--color-text-secondary)]">
            <LogOut className="w-4 h-4" />
            Exit
          </Button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div
          className="text-center mb-8 bg-no-repeat bg-cover bg-center rounded-2xl py-12 px-4 relative overflow-hidden border border-[var(--color-border)]"
          style={{ backgroundImage: "url('https://raw.githubusercontent.com/prebuiltui/prebuiltui/main/assets/hero/gridBackground.png')" }}
        >
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-heading)] max-w-3xl mx-auto">
              Road Conditions In Your Area
            </h1>
            <p className="text-[var(--color-text-secondary)] mt-4 max-w-xl mx-auto">
              Select a district, mandal, and city/village to keep the map focused on that area only.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card className="p-5 h-fit bg-[var(--color-surface)] border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-[var(--color-text-secondary)]" />
              <h2 className="text-lg font-semibold text-[var(--color-heading)]">Area Filter</h2>
            </div>
            <AndhraLocationSelector
              value={locationSelection}
              onChange={handleLocationChange}
              label={false}
            />
            {resolvingArea && (
              <p className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] mt-4">
                <Loader2 className="w-3 h-3 animate-spin" />
                Resolving selected city/village...
              </p>
            )}
            {!area && !resolvingArea && (
              <p className="text-xs text-amber-500 mt-4">Choose district, mandal, and city/village to load the scoped map.</p>
            )}
            {error && <p className="text-xs text-red-400 mt-4">{error}</p>}
          </Card>

          <div className="grid gap-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total", value: stats.total },
                { label: "Reported", value: stats.pending },
                { label: "Accepted", value: stats.verified },
                { label: "Fixed", value: stats.fixed },
              ].map((item) => (
                <Card key={item.label} className="p-4 bg-[var(--color-surface)] border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-secondary)]">{item.label}</p>
                  <p className="text-2xl font-bold text-[var(--color-heading)]">{item.value}</p>
                </Card>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-heading)]">
                    <Map className="w-5 h-5 inline-block mr-2 text-[var(--color-text-secondary)]" />
                    {area?.name || "Select Area"}
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    {area ? `Map is scoped to ${locationLabel}` : "No area selected"}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchPotholes} className="text-[var(--color-text-secondary)]" disabled={loadingMap || !scopedBounds}>
                  {loadingMap ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>

              {loadingMap ? (
                <div className="flex items-center justify-center h-[480px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
                </div>
              ) : (
                <PublicMiniMap
                  key={`${area?.id || "andhra"}-${potholes.length}`}
                  potholes={potholes}
                  bounds={scopedBounds || ANDHRA_STATE.bbox}
                  boundary={area?.boundary || null}
                  height={480}
                  center={area?.latitude && area.longitude ? [area.latitude, area.longitude] : undefined}
                  zoom={area ? 13 : 7}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
