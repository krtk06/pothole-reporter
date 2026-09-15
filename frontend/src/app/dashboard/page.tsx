"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2, LogOut, MapPin, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { PublicPothole, type AdministrativeArea, type MapBoundingBox } from "@/types";
import AndhraLocationSelector, { type AndhraLocationSelection } from "@/components/AndhraLocationSelector";
import { ANDHRA_STATE } from "@/data/andhraDirectory";
import {
  Counter,
  Logo,
  MagneticButton,
  NavBar,
  NavInner,
  NavSpacer,
  Pill,
  Reveal,
  Surface,
  ThemeToggle,
} from "@/components/macadam";

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
  const { user, logout, selectedArea, setAdministrativeArea, theme, toggleTheme } = useStore();
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
    <main className="min-h-dvh">
      <NavBar>
        <NavInner>
          <Logo src="/brand/pothole-reporter.png" name="Pothole Reporter" tagline="Guest view" />
          <NavSpacer />
          {area && (
            <Pill tone="neutral" mono className="hidden max-w-[220px] sm:inline-flex">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{area.name}</span>
            </Pill>
          )}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <MagneticButton
            variant="danger"
            onClick={() => {
              void logout().finally(() => router.push("/login"));
            }}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
          </MagneticButton>
        </NavInner>
      </NavBar>

      <section className="border-b border-hairline">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink3">
              Scoped road conditions
            </p>
            <h1 className="mt-3 font-display text-[clamp(1.9rem,3.6vw,3rem)] font-extrabold tracking-[-0.025em] text-ink">
              {area?.name || "Choose your area"}
            </h1>
            <p className="mt-3 font-mono text-sm text-ink3">{locationLabel}</p>
          </Reveal>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statItems.map((item, index) => (
              <Reveal key={item.label} delay={index * 60}>
                <Surface level={1} className="h-full">
                  <p className="font-mono text-4xl font-semibold tracking-tight text-ink">
                    <Counter value={item.value} />
                  </p>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink3">
                    {item.label}
                  </p>
                </Surface>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <Reveal>
            <Surface level={2} className="h-full">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-ink">Area filter</h2>
                <Pill tone="info">Scope</Pill>
              </div>
              <div className="mt-5 rule" />
              <div className="mt-5">
                <AndhraLocationSelector
                  value={locationSelection}
                  onChange={handleLocationChange}
                  label={false}
                />
              </div>
              {resolvingArea && (
                <p className="mt-4 flex items-center gap-2 text-sm text-ink2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resolving selected city/village…
                </p>
              )}
              {!area && !resolvingArea && (
                <p className="mt-4 text-sm text-warn">
                  Choose district, mandal, and city/village to load the scoped map.
                </p>
              )}
              {error && <p className="mt-4 text-sm text-bad">{error}</p>}
            </Surface>
          </Reveal>

          <Reveal delay={60}>
            <Surface level={2} padded={false} className="h-full overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-base font-bold text-ink">
                    {area?.name || "Select an area"}
                  </h2>
                  <p className="truncate font-mono text-xs text-ink3">
                    {area ? `Scoped to ${locationLabel}` : "No area selected"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone="neutral" mono>
                    {potholes.length} pins
                  </Pill>
                  <MagneticButton
                    variant="secondary"
                    onClick={fetchPotholes}
                    disabled={loadingMap || !scopedBounds}
                  >
                    {loadingMap ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                  </MagneticButton>
                </div>
              </div>

              <div className="relative h-[520px] sm:h-[600px] lg:h-[640px]">
                {loadingMap ? (
                  <div className="flex h-full items-center justify-center bg-sunken">
                    <span className="flex items-center gap-2 font-mono text-sm text-ink2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading map data…
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
            </Surface>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink3 sm:px-6">
          <span>Pothole Reporter — crowdsourced road maintenance for Andhra Pradesh.</span>
          <span className="font-mono">{area ? area.name : "Guest"}</span>
        </div>
      </footer>
    </main>
  );
}
