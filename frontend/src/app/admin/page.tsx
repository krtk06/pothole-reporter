"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Loader2,
  LogOut,
  Map as MapIcon,
  MapPin,
  Plus,
  Receipt,
  RefreshCw,
  Send,
  ShieldAlert,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { AdminReport, Tender, MapCluster, PublicPothole, TenderSyncConfig, TenderSyncLog } from "@/types";
import { ANDHRA_STATE, getFallbackDistricts, getFallbackSubdistricts } from "@/data/andhraDirectory";
import type { AdministrativeArea, MapBoundingBox } from "@/types";
import {
  Counter,
  Field,
  Input,
  Logo,
  MagneticButton,
  NavBar,
  NavInner,
  NavSpacer,
  Pill,
  type PillTone,
  Reveal,
  Surface,
  ThemeToggle,
} from "@/components/macadam";

const DynamicMap = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-[460px] w-full bg-sunken" />,
});

const PAGE_SIZE = 6;

const reportTone: Record<string, PillTone> = {
  pending: "warn",
  verified: "ok",
  rejected: "bad",
  fixed: "info",
};

const tenderTone: Record<string, PillTone> = {
  open: "ok",
  assigned: "info",
  completed: "ok",
  rejected: "bad",
};

const tenderLabel: Record<string, string> = {
  open: "Open",
  assigned: "Accepted",
  completed: "Completed",
  rejected: "Withdrawn",
};

const SECTIONS = [
  { id: "map", label: "Map View", icon: MapIcon },
  { id: "reports", label: "Reports", icon: Receipt },
  { id: "tenders", label: "Tenders", icon: Wallet },
  { id: "sync", label: "Tender Sync", icon: Send },
] as const;

function normalize(value?: string | null) {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

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

function scopeText(user: any) {
  if (!user?.admin_scope) return null;
  if (user.admin_scope === "mandal") return `${user.mandal || "Mandal"} Mandal`;
  if (user.admin_scope === "district") return `${user.district || "District"} District`;
  return `${user.state || "State"} State`;
}

function SectionRail({ active }: { active: string }) {
  return (
    <nav aria-label="Console sections" className="lg:sticky lg:top-24 lg:self-start">
      <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <a
              key={id}
              href={`#${id}`}
              aria-current={isActive ? "true" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-surface text-ink shadow-1"
                  : "text-ink2 hover:bg-sunken hover:text-ink"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-signal" : "text-ink3"}`} />
              {label}
            </a>
          );
        })}
      </div>
      <div className="mt-6 hidden rounded-lg border border-hairline bg-sunken p-3 lg:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink3">
          Jurisdiction
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink2">
          Lists are limited to the scope bound to your account. Sync configuration is state-only.
        </p>
      </div>
    </nav>
  );
}

function PageControl({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-hairline pt-3">
      <MagneticButton
        type="button"
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </MagneticButton>
      <span className="font-mono text-xs text-ink3">
        Page {page} / {pageCount}
      </span>
      <MagneticButton
        type="button"
        variant="secondary"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        Next
      </MagneticButton>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink">
          <Icon className="h-5 w-5 text-signal" />
          {title}
        </h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink2">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout, theme, toggleTheme } = useStore();
  const isStateAdmin = user?.admin_scope === "state";
  const router = useRouter();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [clusters, setClusters] = useState<MapCluster[]>([]);
  const [publicPotholes, setPublicPotholes] = useState<PublicPothole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMap, setLoadingMap] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [mounted, setMounted] = useState(false);
  const [tenderLoading, setTenderLoading] = useState<string | null>(null);
  const [withdrawConfirmId, setWithdrawConfirmId] = useState<string | null>(null);
  const [reportUpdating, setReportUpdating] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [scopeArea, setScopeArea] = useState<AdministrativeArea | null>(null);
  const [activeSection, setActiveSection] = useState<string>("map");

  const [reportPage, setReportPage] = useState(1);
  const [tenderPage, setTenderPage] = useState(1);
  const [reportFeedback, setReportFeedback] = useState<{ id: string; kind: "verify" | "reject" } | null>(null);
  const [syncPulse, setSyncPulse] = useState(false);

  const [syncConfig, setSyncConfig] = useState<TenderSyncConfig | null>(null);
  const [syncLogs, setSyncLogs] = useState<TenderSyncLog[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncTriggering, setSyncTriggering] = useState(false);
  const [syncSaving, setSyncSaving] = useState(false);
  const [targetUrl, setTargetUrl] = useState("http://localhost:3001/api/sync");
  const [apiKey, setApiKey] = useState("");
  const [intervalDays, setIntervalDays] = useState(15);
  const [isEnabled, setIsEnabled] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    if (user.role !== "admin") { router.push("/dashboard"); return; }
    fetchAll();
    void resolveAdminScope();
  }, [user]);

  useEffect(() => {
    setReportPage(1);
  }, [statusFilter]);

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const threshold = 148;
      let current = SECTIONS[0].id as string;
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= threshold) current = id;
      }
      setActiveSection(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mounted]);

  const scopeBounds = areaBounds(scopeArea) || (user?.state === "Andhra Pradesh" ? ANDHRA_STATE.bbox : null);

  const resolveAdminScope = async () => {
    if (!user?.admin_scope || user.state !== "Andhra Pradesh") {
      setScopeArea(null);
      return;
    }

    if (user.admin_scope === "state") {
      setScopeArea({
        id: "state:28",
        name: "Andhra Pradesh",
        displayName: "Andhra Pradesh, India",
        type: "state",
        stateCode: ANDHRA_STATE.code,
        stateName: ANDHRA_STATE.name,
        bbox: ANDHRA_STATE.bbox,
      });
      return;
    }

    const districts = [
      ...((await api.getAdministrativeOptions({ level: "district", q: user.district || "" }).catch(() => ({ areas: [] }))).areas || []),
      ...getFallbackDistricts(user.district || ""),
    ];
    const district = districts.find((area) => normalize(area.name) === normalize(user.district)) || districts[0] || null;

    if (user.admin_scope === "district") {
      if (!district) return setScopeArea(null);
      const resolved = await api.getCurrentAdministrativeArea(district).then((data) => data.area).catch(() => district);
      setScopeArea(resolved);
      return;
    }

    if (user.admin_scope === "mandal" && district?.districtCode) {
      const subdistricts = [
        ...((await api.getAdministrativeOptions({
          level: "subdistrict",
          q: user.mandal || "",
          districtCode: district.districtCode,
        }).catch(() => ({ areas: [] }))).areas || []),
        ...getFallbackSubdistricts(district.districtCode, user.mandal || ""),
      ];
      const subdistrict = subdistricts.find((area) => normalize(area.name) === normalize(user.mandal)) || subdistricts[0] || null;
      if (!subdistrict) return setScopeArea(null);
      const resolved = await api.getCurrentAdministrativeArea(subdistrict).then((data) => data.area).catch(() => subdistrict);
      setScopeArea(resolved);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [reportsData, tendersData, mapData] = await Promise.all([
        api.getAdminReports(),
        api.getTenders(),
        api.getMapClusters(),
      ]);
      setReports(reportsData.reports || []);
      setTenders(tendersData.tenders || []);

      const mapReports: any[] = mapData.potholes?.features?.map((f: any) => ({
        id: f.properties.id,
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
        status: f.properties.status,
        block_id: f.properties.block_id,
        created_at: new Date().toISOString(),
      })) || [];

      setPublicPotholes(mapReports);
      setClusters(mapData.blockDensity || []);
      void fetchSyncConfig();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        void logout().finally(() => router.push("/"));
      }
    } finally {
      setLoading(false);
      setLoadingMap(false);
    }
  };

  const handleTenderAction = async (tenderId: string, action: "assigned" | "rejected") => {
    setTenderLoading(tenderId);
    try {
      await api.updateTenderStatus(tenderId, action);
      setTenders((prev) =>
        prev.map((t) => (t.id === tenderId ? { ...t, status: action } : t))
      );
      setSuccessMsg(`Tender ${action === "assigned" ? "accepted" : "rejected"} successfully`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setTenderLoading(null);
    }
  };

  const handleTenderWithdraw = async (tenderId: string) => {
    if (withdrawConfirmId !== tenderId) {
      setWithdrawConfirmId(tenderId);
      return;
    }
    setWithdrawConfirmId(null);
    setTenderLoading(tenderId);
    try {
      const result = await api.withdrawTender(tenderId);
      setTenders((prev) =>
        prev.map((t) =>
          t.id === tenderId
            ? { ...t, status: result?.tender?.status || "rejected" }
            : t
        )
      );
      setSuccessMsg(
        result?.withdraw_dispatched
          ? "Tender withdrawn and removed from the tendering website"
          : "Tender withdrawn — removal from tender website will complete on the next sync"
      );
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error(err);
      setWithdrawConfirmId(null);
    } finally {
      setTenderLoading(null);
    }
  };

  const handleReportStatus = async (reportId: string, status: "verified" | "rejected") => {
    setReportUpdating(reportId);
    try {
      await api.updateReportStatus(reportId, status);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r))
      );
      setReportFeedback({ id: reportId, kind: status === "verified" ? "verify" : "reject" });
      setTimeout(() => setReportFeedback(null), 350);
    } catch (err: any) {
      console.error(err);
    } finally {
      setReportUpdating(null);
    }
  };

  const fetchSyncConfig = async () => {
    setSyncLoading(true);
    try {
      const data = await api.getTenderSyncConfig();
      if (data?.settings) {
        setSyncConfig(data.settings);
        setTargetUrl(data.settings.target_url || "http://localhost:3001/api/sync");
        setApiKey(data.settings.api_key || "");
        setIntervalDays(data.settings.sync_interval_days || 15);
        setIsEnabled(data.settings.is_enabled ?? true);
      }
      if (data?.logs) {
        setSyncLogs(data.logs);
      }
    } catch (err) {
      console.error("Failed to load tender sync config", err);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSaveSyncConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncSaving(true);
    setSyncFeedback(null);
    try {
      const res = await api.updateTenderSyncConfig({
        target_url: targetUrl,
        api_key: apiKey,
        sync_interval_days: Number(intervalDays),
        is_enabled: isEnabled,
      });
      setSyncConfig(res.settings);
      setSyncFeedback({ type: "success", text: "Tender sync settings updated successfully!" });
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err: any) {
      setSyncFeedback({ type: "error", text: err.message || "Failed to save settings." });
    } finally {
      setSyncSaving(false);
    }
  };

  const handleTriggerSync = async () => {
    setSyncTriggering(true);
    setSyncFeedback(null);
    try {
      const res = await api.triggerTenderSync();
      if (res.success) {
        setSyncFeedback({
          type: "success",
          text: `Sync dispatched! ${res.potholes_count} potholes & ${res.tenders_count} tenders sent to tender website.`,
        });
        setSyncPulse(true);
        setTimeout(() => setSyncPulse(false), 400);
      } else {
        setSyncFeedback({
          type: "error",
          text: res.message || "Sync failed. Please ensure the tender website is running.",
        });
      }
      await fetchSyncConfig();
    } catch (err: any) {
      setSyncFeedback({ type: "error", text: err.message || "Failed to initiate sync." });
    } finally {
      setSyncTriggering(false);
    }
  };

  const handleGenerateApiKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_";
    let key = "tndr_";
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setApiKey(key);
  };

  const filteredReports = statusFilter === "all"
    ? reports
    : reports.filter((r) => r.status === statusFilter);

  const reportPageCount = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const reportPageSafe = Math.min(reportPage, reportPageCount);
  const pagedReports = filteredReports.slice((reportPageSafe - 1) * PAGE_SIZE, reportPageSafe * PAGE_SIZE);

  const tenderPageCount = Math.max(1, Math.ceil(tenders.length / PAGE_SIZE));
  const tenderPageSafe = Math.min(tenderPage, tenderPageCount);
  const pagedTenders = tenders.slice((tenderPageSafe - 1) * PAGE_SIZE, tenderPageSafe * PAGE_SIZE);

  const stats = {
    total: reports.length,
    verified: reports.filter((r) => r.status === "verified").length,
    pending: reports.filter((r) => r.status === "pending").length,
    fixed: reports.filter((r) => r.status === "fixed").length,
    openTenders: tenders.filter((t) => t.status === "open").length,
    assignedTenders: tenders.filter((t) => t.status === "assigned").length,
  };

  const statCards: { label: string; value: number; tone: PillTone }[] = [
    { label: "Total reports", value: stats.total, tone: "info" },
    { label: "Verified", value: stats.verified, tone: "ok" },
    { label: "Pending", value: stats.pending, tone: "warn" },
    { label: "Fixed", value: stats.fixed, tone: "info" },
    { label: "Open tenders", value: stats.openTenders, tone: "accent" },
    { label: "Accepted", value: stats.assignedTenders, tone: "ok" },
  ];

  if (!mounted || !user) return null;

  const scope = scopeText(user);

  return (
    <main className="min-h-dvh">
      <NavBar>
        <NavInner>
          <Logo src="/brand/pothole-reporter.png" name="Admin console" tagline={scope || "Jurisdiction"} />
          <NavSpacer />
          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sunken sm:inline-flex"
            title="Open the dedicated Tender & Contractor Website"
          >
            Tender website
          </a>
          {scope && (
            <Pill tone="accent" className="hidden md:inline-flex">
              <ShieldAlert className="h-3 w-3" />
              {scope}
            </Pill>
          )}
          <span className="hidden font-mono text-xs text-ink3 lg:block">{user.name}</span>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <MagneticButton
            variant="danger"
            onClick={() => {
              void logout().finally(() => router.push("/"));
            }}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </MagneticButton>
        </NavInner>
      </NavBar>

      {successMsg && (
        <div className="fixed right-4 top-20 z-50 flex max-w-sm items-start gap-2 rounded-lg border border-signal/40 bg-surface px-4 py-3 shadow-3 animate-mac-pop">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
          <span className="text-sm text-ink">{successMsg}</span>
        </div>
      )}

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink3">
            Jurisdiction console
          </p>
          <h1 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.75rem)] font-extrabold tracking-[-0.025em] text-ink">
            {scope ? `${scope} operations` : "Operations"}
          </h1>
        </Reveal>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {statCards.map(({ label, value, tone }, index) => (
            <Reveal key={label} delay={index * 40}>
              <Surface level={1} className="h-full p-4">
                <p className="font-mono text-3xl font-semibold tracking-tight text-ink">
                  <Counter value={value} />
                </p>
                <div className="mt-2">
                  <Pill tone={tone}>{label}</Pill>
                </div>
              </Surface>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
          <SectionRail active={activeSection} />

          <div className="min-w-0 space-y-14">
            {/* MAP */}
            <section id="map" className="scroll-mt-28">
              <SectionHeader
                icon={MapIcon}
                title="Pothole distribution"
                description={
                  scopeBounds
                    ? `Bounded to the ${user.admin_scope ?? "account"} level for your jurisdiction.`
                    : "No jurisdiction bounds could be resolved for this account."
                }
              >
                <Pill tone="neutral" mono>
                  <MapPin className="h-3 w-3" />
                  {publicPotholes.length} potholes
                </Pill>
                <Pill tone="neutral" mono>
                  <Hash className="h-3 w-3" />
                  {clusters.length} clusters
                </Pill>
              </SectionHeader>

              <Surface level={2} padded={false} className="mt-5 overflow-hidden">
                {loadingMap ? (
                  <div className="flex h-[460px] items-center justify-center bg-sunken">
                    <span className="flex items-center gap-2 font-mono text-sm text-ink2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading map…
                    </span>
                  </div>
                ) : (
                  <DynamicMap
                    clusters={clusters}
                    potholes={publicPotholes}
                    center={
                      scopeBounds
                        ? [(scopeBounds.north + scopeBounds.south) / 2, (scopeBounds.east + scopeBounds.west) / 2]
                        : [20, 78]
                    }
                    zoom={scopeBounds ? 9 : 5}
                    bounds={scopeBounds}
                  />
                )}
              </Surface>
            </section>

            {/* REPORTS */}
            <section id="reports" className="scroll-mt-28">
              <SectionHeader
                icon={Receipt}
                title="All reports"
                description="Verify or reject incoming reports. Every decision is scoped to your jurisdiction."
              >
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filter reports by status"
                    className="h-10 appearance-none rounded-lg border border-hairline bg-sunken pl-3 pr-9 text-sm font-semibold text-ink outline-none transition-colors focus:border-signal"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239198a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                      backgroundRepeat: "no-repeat",
                      backgroundSize: "16px 16px",
                      backgroundPosition: "right 0.6rem center",
                    }}
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>
                <MagneticButton variant="secondary" onClick={fetchAll}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </MagneticButton>
              </SectionHeader>

              <div className="mt-5">
                {loading ? (
                  <Surface level={1} className="flex items-center justify-center gap-2 py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-ink3" />
                    <span className="font-mono text-sm text-ink2">Loading reports…</span>
                  </Surface>
                ) : filteredReports.length === 0 ? (
                  <Surface level={1} className="flex flex-col items-center gap-2 py-14 text-center">
                    <Receipt className="h-7 w-7 text-ink3" />
                    <p className="text-sm text-ink2">No reports found</p>
                    <p className="text-xs text-ink3">Reports will appear here once submitted from the field.</p>
                  </Surface>
                ) : (
                  <div className="grid gap-3">
                    {pagedReports.map((report) => (
                      <Surface
                        key={report.id}
                        level={1}
                        className={
                          reportFeedback?.id === report.id
                            ? reportFeedback.kind === "verify"
                              ? "animate-mac-pop"
                              : "animate-mac-shake"
                            : undefined
                        }
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Pill tone={reportTone[report.status] ?? "neutral"} pulse={report.status === "pending"}>
                                {report.status}
                              </Pill>
                              {report.block_id && (
                                <Pill tone="neutral" mono>
                                  {report.block_id}
                                </Pill>
                              )}
                            </div>
                            <p className="flex items-center gap-1.5 text-sm text-ink">
                              <UserRound className="h-3.5 w-3.5 text-ink3" />
                              {report.reporter_name}
                              <span className="text-ink3">• {report.reporter_phone || "No phone"}</span>
                            </p>
                            {report.address_notes && (
                              <p className="line-clamp-2 text-sm text-ink2">{report.address_notes}</p>
                            )}
                            <p className="flex items-center gap-1.5 font-mono text-xs text-ink3">
                              <MapPin className="h-3.5 w-3.5" />
                              {Number(report.latitude).toFixed(5)}, {Number(report.longitude).toFixed(5)}
                            </p>
                            <p className="flex items-center gap-1.5 font-mono text-xs text-ink3">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {new Date(report.created_at).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                          {report.status === "pending" && (
                            <div className="flex shrink-0 items-center gap-2">
                              <MagneticButton
                                variant="ok"
                                disabled={reportUpdating === report.id}
                                onClick={() => handleReportStatus(report.id, "verified")}
                              >
                                {reportUpdating === report.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                                Verify
                              </MagneticButton>
                              <MagneticButton
                                variant="danger"
                                disabled={reportUpdating === report.id}
                                onClick={() => handleReportStatus(report.id, "rejected")}
                              >
                                <X className="h-4 w-4" />
                                Reject
                              </MagneticButton>
                            </div>
                          )}
                        </div>
                      </Surface>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <PageControl page={reportPageSafe} pageCount={reportPageCount} onChange={setReportPage} />
                </div>
              </div>
            </section>

            {/* TENDERS */}
            <section id="tenders" className="scroll-mt-28">
              <SectionHeader
                icon={Wallet}
                title="Tenders"
                description="Accept a tender, or unsend it to withdraw it from the tendering website."
              >
                <MagneticButton variant="secondary" onClick={fetchAll}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </MagneticButton>
              </SectionHeader>

              <div className="mt-5">
                {loading ? (
                  <Surface level={1} className="flex items-center justify-center gap-2 py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-ink3" />
                    <span className="font-mono text-sm text-ink2">Loading tenders…</span>
                  </Surface>
                ) : tenders.length === 0 ? (
                  <Surface level={1} className="flex flex-col items-center gap-2 py-14 text-center">
                    <Wallet className="h-7 w-7 text-ink3" />
                    <p className="text-sm text-ink2">No tenders yet</p>
                    <p className="text-xs text-ink3">
                      Tenders are generated automatically once the pothole threshold is met.
                    </p>
                  </Surface>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {pagedTenders.map((tender) => (
                      <Surface key={tender.id} level={1} className="flex h-full flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs text-ink3">{tender.block_id}</p>
                            <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-ink">
                              ₹{Number(tender.estimated_cost).toLocaleString("en-IN")}
                            </p>
                          </div>
                          <Pill tone={tenderTone[tender.status] ?? "neutral"} pulse={tender.status === "open"}>
                            {tenderLabel[tender.status] ?? tender.status}
                          </Pill>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-hairline bg-sunken p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">
                              Potholes
                            </p>
                            <p className="mt-1 font-mono text-lg text-ink">{tender.pothole_count}</p>
                          </div>
                          <div className="rounded-lg border border-hairline bg-sunken p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">
                              Generated
                            </p>
                            <p className="mt-1 font-mono text-sm text-ink">
                              {new Date(tender.generated_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {tender.status === "open" && (
                          <div className="mt-4 flex gap-2 border-t border-hairline pt-4">
                            <MagneticButton
                              variant="ok"
                              block
                              disabled={tenderLoading === tender.id}
                              onClick={() => handleTenderAction(tender.id, "assigned")}
                            >
                              {tenderLoading === tender.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                              Accept
                            </MagneticButton>
                            <MagneticButton
                              variant="danger"
                              block
                              disabled={tenderLoading === tender.id}
                              onClick={() => handleTenderWithdraw(tender.id)}
                            >
                              {withdrawConfirmId === tender.id ? (
                                <>
                                  <AlertTriangle className="h-4 w-4" />
                                  Confirm unsend
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4 rotate-180" />
                                  Unsend
                                </>
                              )}
                            </MagneticButton>
                          </div>
                        )}

                        {tender.status === "assigned" && (
                          <div className="mt-4 flex items-center gap-2 border-t border-hairline pt-4">
                            <Pill tone="info">Accepted</Pill>
                            <span className="text-xs text-ink2">Pending completion</span>
                          </div>
                        )}

                        {tender.status === "rejected" && (
                          <div className="mt-4 flex items-center gap-2 border-t border-hairline pt-4">
                            <Pill tone="bad">Withdrawn</Pill>
                            <span className="text-xs text-ink2">Removed from the tendering website</span>
                          </div>
                        )}
                      </Surface>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <PageControl page={tenderPageSafe} pageCount={tenderPageCount} onChange={setTenderPage} />
                </div>
              </div>
            </section>

            {/* SYNC */}
            <section id="sync" className="scroll-mt-28">
              {!isStateAdmin ? (
                <Surface level={1} className="flex items-start gap-4">
                  <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-warn" />
                  <div>
                    <h2 className="font-display text-lg font-bold text-ink">State admin access only</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink2">
                      Tender website integration, API keys, and the 15–30 day sync schedule are managed
                      exclusively by state-level administrators. Your jurisdiction does not include this
                      configuration.
                    </p>
                  </div>
                </Surface>
              ) : (
                <>
                  <SectionHeader
                    icon={Send}
                    title="Tender website integration & periodic sync"
                    description="Export verified potholes, photos, and GPS to the contractor portal via API key every 15 to 30 days."
                  >
                    <MagneticButton variant="secondary" onClick={fetchSyncConfig} disabled={syncLoading}>
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </MagneticButton>
                    <a
                      href="http://localhost:3001"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-signal px-4 py-2.5 text-sm font-semibold leading-none text-onsignal transition-colors hover:bg-signal2"
                    >
                      Open tender website
                    </a>
                  </SectionHeader>

                  {syncFeedback && (
                    <div
                      className={`mt-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                        syncFeedback.type === "success"
                          ? "border-ok/40 bg-ok/10 animate-mac-pop"
                          : "border-bad/40 bg-bad/10 animate-mac-shake"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm text-ink">
                        {syncFeedback.type === "success" ? (
                          <Check className="h-4 w-4 text-ok" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-bad" />
                        )}
                        {syncFeedback.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSyncFeedback(null)}
                        aria-label="Dismiss"
                        className="text-ink3 transition-colors hover:text-ink"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Surface level={1} className="p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">
                        Integration status
                      </p>
                      <div className="mt-2">
                        <Pill tone={isEnabled ? "ok" : "neutral"} pulse={isEnabled}>
                          {isEnabled ? "Active & scheduled" : "Sync disabled"}
                        </Pill>
                      </div>
                    </Surface>
                    <Surface level={1} className="p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">
                        Sync cycle
                      </p>
                      <p className="mt-2 flex items-center gap-2 font-mono text-sm text-ink">
                        <Clock className="h-4 w-4 text-info" />
                        Every {intervalDays} days
                      </p>
                    </Surface>
                    <Surface level={1} className="p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">
                        Next dispatch
                      </p>
                      <p className="mt-2 flex items-center gap-2 font-mono text-sm text-ink">
                        <CalendarDays className="h-4 w-4 text-warn" />
                        {syncConfig?.next_sync_at
                          ? new Date(syncConfig.next_sync_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Pending setup"}
                      </p>
                    </Surface>
                    <Surface level={1} className="p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">
                        Last sync result
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Pill
                          tone={
                            syncConfig?.last_sync_status === "success"
                              ? "ok"
                              : syncConfig?.last_sync_status === "failed"
                              ? "bad"
                              : "neutral"
                          }
                        >
                          {syncConfig?.last_sync_status === "success"
                            ? "Delivered"
                            : syncConfig?.last_sync_status === "failed"
                            ? "Failed"
                            : "Idle"}
                        </Pill>
                        {syncConfig?.last_sync_at && (
                          <span className="font-mono text-xs text-ink3">
                            {new Date(syncConfig.last_sync_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </Surface>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    <Surface level={2} className="lg:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="font-display text-base font-bold text-ink">
                          Configuration & schedule
                        </h3>
                        <Pill tone="accent">Admin managed</Pill>
                      </div>
                      <p className="mt-1 text-sm text-ink2">
                        Configure the destination endpoint, credentials, and frequency.
                      </p>
                      <div className="mt-4 rule" />

                      <form onSubmit={handleSaveSyncConfig} className="mt-5 space-y-5">
                        <Field
                          label="Ingestion endpoint URL"
                          htmlFor="targetUrl"
                          hint="The tender portal route that accepts an HTTP POST with the JSON payload."
                          required
                        >
                          <Input
                            id="targetUrl"
                            type="url"
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            placeholder="http://localhost:3001/api/sync"
                            className="font-mono text-xs"
                            required
                          />
                        </Field>

                        <Field label="API key" htmlFor="apiKey" required>
                          <div className="flex items-center gap-2">
                            <Input
                              id="apiKey"
                              type={showApiKey ? "text" : "password"}
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              placeholder="Secret shared with the tender website"
                              className="font-mono text-xs"
                              required
                            />
                            <MagneticButton
                              type="button"
                              variant="secondary"
                              onClick={() => setShowApiKey((v) => !v)}
                            >
                              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              {showApiKey ? "Hide" : "Show"}
                            </MagneticButton>
                          </div>
                        </Field>

                        <div className="flex flex-wrap items-center gap-2">
                          <KeyRound className="h-4 w-4 text-ink3" />
                          <button
                            type="button"
                            onClick={handleGenerateApiKey}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-signal underline-offset-4 hover:underline"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Generate a new key
                          </button>
                          <span className="text-xs text-ink3">
                            Sent as <code className="font-mono">X-API-Key</code>; the tender website verifies it
                            before accepting any batch.
                          </span>
                        </div>

                        <Field label="Automatic sync frequency" htmlFor="interval">
                          <div className="flex flex-wrap items-center gap-2">
                            {[15, 20, 25, 30].map((days) => (
                              <MagneticButton
                                key={days}
                                type="button"
                                variant={intervalDays === days ? "primary" : "secondary"}
                                onClick={() => setIntervalDays(days)}
                              >
                                {days} days
                              </MagneticButton>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center gap-3 rounded-lg border border-hairline bg-sunken p-3">
                            <input
                              id="interval"
                              type="range"
                              min="15"
                              max="30"
                              step="1"
                              value={intervalDays}
                              onChange={(e) => setIntervalDays(Number(e.target.value))}
                              className="flex-1 accent-signal"
                            />
                            <span className="min-w-[68px] text-right font-mono text-sm tnum text-ink">
                              {intervalDays} days
                            </span>
                          </div>
                        </Field>

                        <label className="flex cursor-pointer select-none items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => setIsEnabled(e.target.checked)}
                            className="h-4 w-4 accent-signal"
                          />
                          <span className="text-sm text-ink">Enable automated background scheduling</span>
                        </label>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5">
                          <MagneticButton type="submit" variant="primary" disabled={syncSaving}>
                            {syncSaving ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4" />
                                Save configuration
                              </>
                            )}
                          </MagneticButton>
                          <p className="text-xs text-ink3">Changes apply to the scheduler immediately.</p>
                        </div>
                      </form>
                    </Surface>

                    <div className="space-y-4">
                      <Surface level={2}>
                        <h3 className="font-display text-base font-bold text-ink">Manual trigger</h3>
                        <p className="mt-1 text-sm text-ink2">
                          Dispatch immediately instead of waiting for the 15–30 day timer.
                        </p>
                        <div className={`mt-4 ${syncPulse ? "animate-mac-pop" : ""}`}>
                          <MagneticButton
                            variant="primary"
                            block
                            onClick={handleTriggerSync}
                            disabled={syncTriggering}
                          >
                            {syncTriggering ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Transmitting
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4" />
                                Sync now
                              </>
                            )}
                          </MagneticButton>
                        </div>
                      </Surface>

                      <Surface level={1}>
                        <h3 className="font-display text-base font-bold text-ink">What gets sent</h3>
                        <ul className="mt-3 space-y-2 text-sm text-ink2">
                          <li>
                            <span className="font-semibold text-ink">Verified potholes:</span> latitude &amp;
                            longitude.
                          </li>
                          <li>
                            <span className="font-semibold text-ink">Visual evidence:</span> presigned photo URLs.
                          </li>
                          <li>
                            <span className="font-semibold text-ink">Tender packages:</span> cluster counts &amp;
                            budgets (₹).
                          </li>
                          <li>
                            <span className="font-semibold text-ink">Location:</span> mandals, blocks, road notes.
                          </li>
                        </ul>
                      </Surface>
                    </div>
                  </div>

                  <Surface level={2} padded={false} className="mt-5 overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3">
                      <h3 className="font-display text-base font-bold text-ink">Sync audit logs</h3>
                      <Pill tone="neutral" mono>
                        {syncLogs.length} records
                      </Pill>
                    </div>
                    {syncLogs.length === 0 ? (
                      <div className="flex flex-col items-center gap-1 py-10 text-center">
                        <Clock className="h-6 w-6 text-ink3" />
                        <p className="text-sm text-ink2">No sync transmissions logged yet.</p>
                        <p className="text-xs text-ink3">Run “Sync now” to record the first transmission.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-hairline">
                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">Timestamp</th>
                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">Trigger</th>
                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">Potholes</th>
                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">Tenders</th>
                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">Status</th>
                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">HTTP</th>
                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {syncLogs.map((log) => (
                              <tr key={log.id} className="border-b border-hairline last:border-0">
                                <td className="px-4 py-3 font-mono tnum text-ink">
                                  {new Date(log.synced_at).toLocaleString()}
                                </td>
                                <td className="px-4 py-3">
                                  <Pill tone="neutral" mono>
                                    {log.triggered_by}
                                  </Pill>
                                </td>
                                <td className="px-4 py-3 font-mono tnum text-ink">{log.potholes_count}</td>
                                <td className="px-4 py-3 font-mono tnum text-ink">{log.tenders_count}</td>
                                <td className="px-4 py-3">
                                  <Pill tone={log.status === "success" ? "ok" : "bad"}>
                                    {log.status === "success" ? "Success" : "Failed"}
                                  </Pill>
                                </td>
                                <td className="px-4 py-3 font-mono text-ink3">
                                  {log.response_status ? log.response_status : "—"}
                                </td>
                                <td className="max-w-xs truncate px-4 py-3 text-ink2">
                                  {log.error_message || "Payload delivered successfully"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Surface>
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      <footer className="mt-8 border-t border-hairline">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink3 sm:px-6">
          <span>Pothole Reporter — admin console.</span>
          <span className="font-mono">{user.name}</span>
        </div>
      </footer>
    </main>
  );
}
