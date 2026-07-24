"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2, LogOut, Map, MapPin, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { PublicPothole } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import LocationSelector from "@/components/LocationSelector";
import { getDistrictBounds, getMandalBounds, getStateBounds } from "@/data/india-locations";

const PublicMiniMap = dynamic(() => import("@/components/PublicMiniMap"), { ssr: false });

export default function Dashboard() {
  const {
    user,
    logout,
    selectedState,
    selectedDistrict,
    selectedMandal,
    setLocation,
  } = useStore();
  const router = useRouter();
  const [potholes, setPotholes] = useState<PublicPothole[]>([]);
  const [loadingMap, setLoadingMap] = useState(true);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [areaState, setAreaState] = useState("");
  const [areaDistrict, setAreaDistrict] = useState("");
  const [areaMandal, setAreaMandal] = useState("");

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
    if (!user) return;
    setAreaState(selectedState || user.state || "");
    setAreaDistrict(selectedDistrict || user.district || "");
    setAreaMandal(selectedMandal || user.mandal || "");
  }, [user]);

  useEffect(() => {
    if (!mounted || !user || user.role === "admin") return;
    setLocation(areaState, areaDistrict, areaMandal);
  }, [areaState, areaDistrict, areaMandal, mounted, setLocation, user]);

  const state = areaState;
  const district = areaDistrict;
  const mandal = areaMandal;

  const scopedBounds = useMemo(() => {
    if (state && district && mandal) return getMandalBounds(state, district, mandal);
    if (state && district) return getDistrictBounds(state, district);
    if (state) return getStateBounds(state);
    return null;
  }, [state, district, mandal]);

  const locationLabel = [mandal, district, state].filter(Boolean).join(", ");

  const fetchPotholes = async () => {
    if (!state || !district || !mandal) {
      setPotholes([]);
      setLoadingMap(false);
      return;
    }

    setLoadingMap(true);
    setError("");
    try {
      const data = await api.getPublicPotholes(state, district, mandal);
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
  }, [user, state, district, mandal]);

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
          {locationLabel && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-full px-3 py-1">
              <MapPin className="w-3 h-3" />
              {locationLabel}
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
            <div className="inline-flex items-center gap-2 border border-[var(--color-border)] rounded-full px-4 py-1.5 text-xs text-[var(--color-text-secondary)] mb-5 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Guest map view
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-heading)] max-w-3xl mx-auto">
              Road Conditions In Your Area
            </h1>
            <p className="text-[var(--color-text-secondary)] mt-4 max-w-xl mx-auto">
              Select a state, district, and mandal to keep the map focused on that area only.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card className="p-5 h-fit bg-[var(--color-surface)] border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-[var(--color-text-secondary)]" />
              <h2 className="text-lg font-semibold text-[var(--color-heading)]">Area Filter</h2>
            </div>
            <LocationSelector
              selectedState={state}
              selectedDistrict={district}
              selectedMandal={mandal}
              onStateChange={setAreaState}
              onDistrictChange={setAreaDistrict}
              onMandalChange={setAreaMandal}
              required
              label={false}
            />
            {(!state || !district || !mandal) && (
              <p className="text-xs text-amber-500 mt-4">Choose all three fields to load the map.</p>
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
                    {locationLabel || "Select Area"}
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    {locationLabel ? `Map is scoped to ${locationLabel}` : "No area selected"}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchPotholes} className="text-[var(--color-text-secondary)]" disabled={loadingMap}>
                  {loadingMap ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>

              {loadingMap ? (
                <div className="flex items-center justify-center h-[480px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
                </div>
              ) : (
                <PublicMiniMap
                  key={`${state}-${district}-${mandal}-${potholes.length}`}
                  potholes={potholes}
                  bounds={scopedBounds}
                  height={480}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
