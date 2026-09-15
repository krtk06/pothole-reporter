"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { AdminReport, Tender, MapCluster, PublicPothole, TenderSyncConfig, TenderSyncLog } from "@/types";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ANDHRA_STATE, getFallbackDistricts, getFallbackSubdistricts } from "@/data/andhraDirectory";
import type { AdministrativeArea, MapBoundingBox } from "@/types";
import dynamic from "next/dynamic";
import PixelIcon from "@/components/pixel/PixelIcon";
import BrandLogo from "@/components/pixel/BrandLogo";
import { PixelWindow, PixelButton, PixelLamp, PixelChip } from "@/components/pixel/PixelUI";
import DotPager from "@/components/pixel/DotPager";

const DynamicMap = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="px-well h-[420px] w-full" />,
});

const PAGE_SIZE = 6;

type LampStatus = "open" | "review" | "assigned" | "done";

const reportLamp: Record<string, LampStatus> = {
  pending: "review",
  verified: "open",
  rejected: "done",
  fixed: "assigned",
};

const reportTone: Record<string, string> = {
  pending: "text-orange",
  verified: "text-green",
  rejected: "text-red",
  fixed: "text-blue",
};

const tenderLamp: Record<string, LampStatus> = {
  open: "open",
  assigned: "assigned",
  completed: "done",
  rejected: "done",
};

const tenderTone: Record<string, string> = {
  open: "text-green",
  assigned: "text-blue",
  completed: "text-green",
  rejected: "text-red",
};

const tenderLabel: Record<string, string> = {
  open: "Open",
  assigned: "Accepted",
  completed: "Completed",
  rejected: "Withdrawn",
};

const PAGES = [
  { id: "map", label: "Map View" },
  { id: "reports", label: "Reports" },
  { id: "tenders", label: "Tenders" },
  { id: "sync", label: "Tender Sync" },
];

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

function ScopeLabel({ user }: { user: any }) {
  if (!user?.admin_scope) return null;
  const scopeText =
    user.admin_scope === "mandal"
      ? `${user.mandal || "Mandal"} Mandal`
      : user.admin_scope === "district"
      ? `${user.district || "District"} District`
      : `${user.state || "State"} State`;

  return (
    <PixelChip className="hidden sm:inline-flex">
      <PixelIcon name="user" size={10} />
      <span>{scopeText} Admin</span>
    </PixelChip>
  );
}

function PixelPager({
  page,
  pageCount,
  onChange,
  className = "",
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-2 border-t-2 border-[var(--px-line)] bg-[var(--px-panel)] px-2 py-1.5 ${className}`}
    >
      <PixelButton
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        <PixelIcon name="chevR" size={12} className="rotate-180" />
        Prev
      </PixelButton>
      <span className="ledger text-dim">
        Page {page} / {pageCount}
      </span>
      <PixelButton
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
      >
        Next
        <PixelIcon name="chevR" size={12} />
      </PixelButton>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useStore();
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

  // Fixed-viewport pagination + feedback animation state (presentation only)
  const [reportPage, setReportPage] = useState(1);
  const [tenderPage, setTenderPage] = useState(1);
  const [reportFeedback, setReportFeedback] = useState<{ id: string; kind: "verify" | "reject" } | null>(null);
  const [syncPulse, setSyncPulse] = useState(false);

  // Tender Sync State
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

      // Handle both old and new map API response format
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
    // Two-step confirm: first click arms the button, second click executes.
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

  // Client-side pagination (fixed viewport never scrolls)
  const reportPageCount = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const reportPageSafe = Math.min(reportPage, reportPageCount);
  const pagedReports = filteredReports.slice((reportPageSafe - 1) * PAGE_SIZE, reportPageSafe * PAGE_SIZE);

  const tenderPageCount = Math.max(1, Math.ceil(tenders.length / PAGE_SIZE));
  const tenderPageSafe = Math.min(tenderPage, tenderPageCount);
  const pagedTenders = tenders.slice((tenderPageSafe - 1) * PAGE_SIZE, tenderPageSafe * PAGE_SIZE);

  // Stats
  const stats = {
    total: reports.length,
    verified: reports.filter((r) => r.status === "verified").length,
    pending: reports.filter((r) => r.status === "pending").length,
    fixed: reports.filter((r) => r.status === "fixed").length,
    openTenders: tenders.filter((t) => t.status === "open").length,
    assignedTenders: tenders.filter((t) => t.status === "assigned").length,
  };

  const statCards: { label: string; value: number; tone: string }[] = [
    { label: "Total Reports", value: stats.total, tone: "text-blue" },
    { label: "Verified", value: stats.verified, tone: "text-green" },
    { label: "Pending", value: stats.pending, tone: "text-orange" },
    { label: "Fixed", value: stats.fixed, tone: "text-blue" },
    { label: "Open Tenders", value: stats.openTenders, tone: "text-gold" },
    { label: "Accepted", value: stats.assignedTenders, tone: "text-green" },
  ];

  if (!mounted || !user) return null;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--px-void)]">
      {/* Fixed header strip */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-[var(--px-line)] bg-[var(--px-panel)] px-2 py-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-2">
          <BrandLogo
            src="/brand/pothole-reporter.png"
            alt="Pothole Reporter"
            size={34}
            fallback={
              <span className="px-bevel grid h-7 w-7 shrink-0 place-items-center bg-[var(--px-gold)] text-[var(--px-on-accent)]">
                <PixelIcon name="grid" size={14} />
              </span>
            }
          />
          <span className="font-pixel truncate text-[10px] text-body">ADMIN PANEL</span>
          <ScopeLabel user={user} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noreferrer"
            className="px-btn px-btn-gold hidden items-center gap-1 sm:inline-flex"
            title="Open dedicated Tender & Contractor Website"
          >
            <PixelIcon name="chevR" size={12} />
            Tender Website
          </a>
          <span className="hidden font-body text-sm text-dim md:block">{user.name}</span>
          <ThemeToggle />
          <PixelButton
            type="button"
            variant="red"
            onClick={() => { void logout().finally(() => router.push("/")); }}
          >
            <PixelIcon name="close" size={12} />
            Logout
          </PixelButton>
        </div>
      </header>

      {/* Compact numeral-first stats strip */}
      <div className="grid shrink-0 grid-cols-3 gap-2 px-2 pt-2 sm:px-3 lg:grid-cols-6">
        {statCards.map(({ label, value, tone }) => (
          <div key={label} className="px-window px-2 py-1.5">
            <p className="font-pixel text-sm leading-none tnum text-body">{value}</p>
            <p className={`ledger mt-1 truncate ${tone}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="px-window px-anim-stamp fixed right-4 top-4 z-50 flex items-center gap-2 px-3 py-2">
          <PixelIcon name="check" size={14} className="text-green" />
          <span className="font-body text-sm text-body">{successMsg}</span>
        </div>
      )}

      <DotPager pages={PAGES} className="flex-1 min-h-0 mt-2">
        {/* ---------- MAP PANEL ---------- */}
        <div className="flex h-full min-h-0 flex-col px-2 pb-14 pt-2 sm:px-3 lg:pb-3 lg:pr-12">
          <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-pixel text-[11px] text-body">
              <PixelIcon name="map" size={14} className="text-gold" />
              POTHOLE DISTRIBUTION
              {scopeBounds && (
                <span className="font-body text-xs font-normal text-dim">
                  — bounded to {user.admin_scope} level
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <PixelChip>
                <PixelIcon name="pin" size={10} />
                {publicPotholes.length} potholes
              </PixelChip>
              <PixelChip>
                <PixelIcon name="grid" size={10} />
                {clusters.length} clusters
              </PixelChip>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-scroll">
            {loadingMap ? (
              <div className="px-well h-[420px] w-full" />
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
          </div>
        </div>

        {/* ---------- REPORTS PANEL ---------- */}
        <div className="flex h-full min-h-0 flex-col px-2 pb-14 pt-2 sm:px-3 lg:pb-3 lg:pr-12">
          <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-pixel text-[11px] text-body">
              <PixelIcon name="file" size={14} className="text-gold" />
              ALL REPORTS
            </h2>
            <div className="flex items-center gap-2">
              <span className="relative inline-flex items-center">
                <PixelIcon name="filter" size={12} className="pointer-events-none absolute left-2 text-dim" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-well appearance-none bg-[var(--px-well)] py-1.5 pl-7 pr-3 font-pixel text-[9px] uppercase text-body outline-none"
                  aria-label="Filter reports by status"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                  <option value="fixed">Fixed</option>
                </select>
              </span>
              <PixelButton type="button" onClick={fetchAll} title="Refresh reports">
                <PixelIcon name="clock" size={12} />
                Refresh
              </PixelButton>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-scroll pr-1">
            {loading ? (
              <div className="px-well flex items-center justify-center gap-2 p-6">
                <PixelIcon name="clock" size={14} className="px-anim-bob text-dim" />
                <span className="font-pixel text-[10px] text-dim">LOADING</span>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="px-well flex flex-col items-center gap-2 p-10 text-center">
                <PixelIcon name="warn" size={28} className="text-dim" />
                <p className="font-body text-sm text-dim">No reports found</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {pagedReports.map((report) => (
                  <div
                    key={report.id}
                    className={`px-window p-3 ${
                      reportFeedback?.id === report.id
                        ? reportFeedback.kind === "verify"
                          ? "px-anim-stamp"
                          : "px-anim-shake"
                        : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <PixelChip>
                            <PixelLamp status={reportLamp[report.status] ?? "done"} />
                            <span className={reportTone[report.status] ?? "text-dim"}>{report.status}</span>
                          </PixelChip>
                          {report.block_id && (
                            <PixelChip className="font-mono tnum text-dim">{report.block_id}</PixelChip>
                          )}
                        </div>
                        <p className="font-body text-sm text-body">
                          <PixelIcon name="user" size={12} className="mr-1 inline-block align-middle text-dim" />
                          {report.reporter_name} • {report.reporter_phone || "No phone"}
                        </p>
                        {report.address_notes && (
                          <p className="line-clamp-2 font-body text-xs text-dim">{report.address_notes}</p>
                        )}
                        <p className="font-mono text-xs tnum text-dim">
                          <PixelIcon name="pin" size={12} className="mr-1 inline-block align-middle" />
                          {Number(report.latitude).toFixed(5)}, {Number(report.longitude).toFixed(5)}
                        </p>
                        <p className="font-body text-xs text-dim">
                          {new Date(report.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                        </p>
                      </div>
                      {report.status === "pending" && (
                        <div className="flex shrink-0 items-center gap-2">
                          <PixelButton
                            type="button"
                            variant="green"
                            disabled={reportUpdating === report.id}
                            onClick={() => handleReportStatus(report.id, "verified")}
                          >
                            {reportUpdating === report.id ? (
                              "…"
                            ) : (
                              <>
                                <PixelIcon name="check" size={12} />
                                Verify
                              </>
                            )}
                          </PixelButton>
                          <PixelButton
                            type="button"
                            variant="red"
                            disabled={reportUpdating === report.id}
                            onClick={() => handleReportStatus(report.id, "rejected")}
                          >
                            <PixelIcon name="close" size={12} />
                            Reject
                          </PixelButton>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <PixelPager
            page={reportPageSafe}
            pageCount={reportPageCount}
            onChange={setReportPage}
            className="mt-2"
          />
        </div>

        {/* ---------- TENDERS PANEL ---------- */}
        <div className="flex h-full min-h-0 flex-col px-2 pb-14 pt-2 sm:px-3 lg:pb-3 lg:pr-12">
          <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 font-pixel text-[11px] text-body">
                <PixelIcon name="coin" size={14} className="text-gold" />
                TENDERS
              </h2>
              <p className="font-body text-xs text-dim">
                Accept tenders or unsend to remove them from the tendering website
              </p>
            </div>
            <PixelButton type="button" onClick={fetchAll} title="Refresh tenders">
              <PixelIcon name="clock" size={12} />
              Refresh
            </PixelButton>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-scroll pr-1">
            {loading ? (
              <div className="px-well flex items-center justify-center gap-2 p-6">
                <PixelIcon name="clock" size={14} className="px-anim-bob text-dim" />
                <span className="font-pixel text-[10px] text-dim">LOADING</span>
              </div>
            ) : tenders.length === 0 ? (
              <div className="px-well flex flex-col items-center gap-2 p-10 text-center">
                <PixelIcon name="file" size={28} className="text-dim" />
                <p className="font-body text-sm text-dim">No tenders yet</p>
                <p className="font-body text-xs text-dim">Tenders are auto-generated when pothole threshold is met</p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {pagedTenders.map((tender) => (
                  <div key={tender.id} className="px-window flex flex-col gap-3 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="ledger truncate text-gold">{tender.block_id}</p>
                        <p className="font-pixel text-sm tnum text-body">
                          ₹{Number(tender.estimated_cost).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <PixelChip>
                        <PixelLamp status={tenderLamp[tender.status] ?? "done"} />
                        <span className={tenderTone[tender.status] ?? "text-dim"}>
                          {tenderLabel[tender.status] ?? tender.status}
                        </span>
                      </PixelChip>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="px-well p-2">
                        <p className="ledger text-dim">Potholes</p>
                        <p className="font-pixel text-[10px] tnum text-body">{tender.pothole_count}</p>
                      </div>
                      <div className="px-well p-2">
                        <p className="ledger text-dim">Generated</p>
                        <p className="font-body text-xs text-body">
                          {new Date(tender.generated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {tender.status === "open" && (
                      <div className="mt-auto flex gap-2 border-t-2 border-[var(--px-line)] pt-2">
                        <PixelButton
                          type="button"
                          variant="green"
                          className="flex-1"
                          disabled={tenderLoading === tender.id}
                          onClick={() => handleTenderAction(tender.id, "assigned")}
                        >
                          {tenderLoading === tender.id ? (
                            "…"
                          ) : (
                            <>
                              <PixelIcon name="check" size={12} />
                              Accept
                            </>
                          )}
                        </PixelButton>
                        <PixelButton
                          type="button"
                          variant="red"
                          className="flex-1"
                          disabled={tenderLoading === tender.id}
                          onClick={() => handleTenderWithdraw(tender.id)}
                        >
                          {tenderLoading === tender.id ? (
                            "…"
                          ) : withdrawConfirmId === tender.id ? (
                            <>
                              <PixelIcon name="warn" size={12} />
                              Confirm Unsend
                            </>
                          ) : (
                            <>
                              <PixelIcon name="send" size={12} className="rotate-180" />
                              Unsend
                            </>
                          )}
                        </PixelButton>
                      </div>
                    )}

                    {tender.status === "assigned" && (
                      <div className="mt-auto flex items-center gap-2 border-t-2 border-[var(--px-line)] pt-2">
                        <PixelLamp status="assigned" />
                        <span className="font-body text-xs text-blue">Accepted — pending completion</span>
                      </div>
                    )}

                    {tender.status === "rejected" && (
                      <div className="mt-auto flex items-center gap-2 border-t-2 border-[var(--px-line)] pt-2">
                        <PixelLamp status="done" />
                        <span className="font-body text-xs text-red">Withdrawn — removed from tendering website</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <PixelPager
            page={tenderPageSafe}
            pageCount={tenderPageCount}
            onChange={setTenderPage}
            className="mt-2"
          />
        </div>

        {/* ---------- SYNC PANEL ---------- */}
        <div className="flex h-full min-h-0 flex-col px-2 pb-14 pt-2 sm:px-3 lg:pb-3 lg:pr-12">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-scroll pr-1">
            {!isStateAdmin ? (
              <PixelWindow title="Tender Sync" icon="send" className="p-4">
                <div className="flex items-start gap-3">
                  <PixelIcon name="warn" size={20} className="mt-0.5 shrink-0 text-gold" />
                  <div>
                    <p className="font-pixel text-[10px] text-gold">STATE ADMIN ACCESS ONLY</p>
                    <p className="mt-1 font-body text-xs text-dim">
                      Tender website integration, API keys and the 15–30 day sync schedule are managed
                      exclusively by state-level administrators. Your jurisdiction (mandal/district) does
                      not include this configuration.
                    </p>
                  </div>
                </div>
              </PixelWindow>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 font-pixel text-[11px] text-body">
                      <PixelIcon name="send" size={14} className="text-gold" />
                      TENDER WEBSITE INTEGRATION &amp; PERIODIC SYNC
                    </h2>
                    <p className="font-body text-xs text-dim">
                      Automatically export verified potholes, high-res photos, and GPS coordinates to the
                      contractor tender website via API key every 15 to 30 days.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PixelButton type="button" onClick={fetchSyncConfig} disabled={syncLoading}>
                      <PixelIcon name="clock" size={12} />
                      Refresh
                    </PixelButton>
                    <a
                      href="http://localhost:3001"
                      target="_blank"
                      rel="noreferrer"
                      className="px-btn px-btn-gold inline-flex items-center gap-1"
                    >
                      <PixelIcon name="chevR" size={12} />
                      Open Tender Website
                    </a>
                  </div>
                </div>

                {syncFeedback && (
                  <div
                    className={`px-window flex items-center justify-between gap-2 p-3 ${
                      syncFeedback.type === "success" ? "px-anim-stamp" : "px-anim-shake"
                    }`}
                  >
                    <span
                      className={`flex items-center gap-2 font-body text-sm ${
                        syncFeedback.type === "success" ? "text-green" : "text-red"
                      }`}
                    >
                      <PixelIcon name={syncFeedback.type === "success" ? "check" : "warn"} size={14} />
                      {syncFeedback.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSyncFeedback(null)}
                      className="text-dim hover:text-body"
                      aria-label="Dismiss"
                    >
                      <PixelIcon name="close" size={14} />
                    </button>
                  </div>
                )}

                {/* Status summary */}
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <div className="px-window p-2.5">
                    <p className="ledger text-dim">Integration Status</p>
                    <div className="mt-1 flex items-center gap-2">
                      <PixelLamp status={isEnabled ? "open" : "done"} />
                      <span className="font-body text-sm text-body">
                        {isEnabled ? "Active & Scheduled" : "Sync Disabled"}
                      </span>
                    </div>
                  </div>
                  <div className="px-window p-2.5">
                    <p className="ledger text-dim">Sync Cycle</p>
                    <div className="mt-1 flex items-center gap-2">
                      <PixelIcon name="clock" size={14} className="text-blue" />
                      <span className="font-body text-sm text-body">Every {intervalDays} Days</span>
                    </div>
                  </div>
                  <div className="px-window p-2.5">
                    <p className="ledger text-dim">Next Scheduled Dispatch</p>
                    <div className="mt-1 flex items-center gap-2">
                      <PixelIcon name="clock" size={14} className="text-orange" />
                      <span className="font-body text-sm text-body">
                        {syncConfig?.next_sync_at
                          ? new Date(syncConfig.next_sync_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Pending setup"}
                      </span>
                    </div>
                  </div>
                  <div className="px-window p-2.5">
                    <p className="ledger text-dim">Last Sync Result</p>
                    <div className="mt-1 flex items-center gap-2">
                      <PixelChip>
                        <PixelLamp
                          status={
                            syncConfig?.last_sync_status === "success"
                              ? "open"
                              : syncConfig?.last_sync_status === "failed"
                              ? "done"
                              : "review"
                          }
                        />
                        <span
                          className={
                            syncConfig?.last_sync_status === "success"
                              ? "text-green"
                              : syncConfig?.last_sync_status === "failed"
                              ? "text-red"
                              : "text-dim"
                          }
                        >
                          {syncConfig?.last_sync_status === "success"
                            ? "Delivered"
                            : syncConfig?.last_sync_status === "failed"
                            ? "Failed"
                            : "Idle"}
                        </span>
                      </PixelChip>
                      {syncConfig?.last_sync_at && (
                        <span className="font-body text-xs text-dim">
                          {new Date(syncConfig.last_sync_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  {/* Configuration form */}
                  <PixelWindow title="Configuration & Schedule" icon="grid" className="p-3 lg:col-span-2">
                    <div className="mb-2 flex items-center justify-between gap-2 border-b-2 border-[var(--px-line)] pb-2">
                      <p className="font-body text-xs text-dim">
                        Configure destination tender API endpoint, security credentials, and frequency.
                      </p>
                      <PixelChip>Admin Managed</PixelChip>
                    </div>

                    <form onSubmit={handleSaveSyncConfig} className="space-y-3">
                      <div>
                        <label htmlFor="targetUrl" className="ledger mb-1 block text-dim">
                          Tender Website Ingestion Endpoint URL
                        </label>
                        <input
                          id="targetUrl"
                          type="url"
                          value={targetUrl}
                          onChange={(e) => setTargetUrl(e.target.value)}
                          placeholder="http://localhost:3001/api/sync"
                          required
                          className="px-well w-full bg-[var(--px-well)] px-2 py-2 font-mono text-xs text-body outline-none"
                        />
                        <p className="mt-1 font-body text-[11px] text-dim">
                          The tender portal route that accepts HTTP POST with JSON pothole &amp; tender payload.
                        </p>
                      </div>

                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label htmlFor="apiKey" className="ledger text-dim">
                            API Key (Authentication Secret)
                          </label>
                          <button
                            type="button"
                            onClick={handleGenerateApiKey}
                            className="ledger inline-flex items-center gap-1 text-gold underline"
                          >
                            <PixelIcon name="plus" size={10} />
                            Generate New Key
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="apiKey"
                            type={showApiKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter secret API key shared with tender website"
                            required
                            className="px-well min-w-0 flex-1 bg-[var(--px-well)] px-2 py-2 font-mono text-xs text-body outline-none"
                          />
                          <PixelButton type="button" onClick={() => setShowApiKey((v) => !v)}>
                            <PixelIcon name="eye" size={12} />
                            {showApiKey ? "Hide" : "Show"}
                          </PixelButton>
                        </div>
                        <p className="mt-1 font-body text-[11px] text-dim">
                          Sent in the{" "}
                          <code className="px-well bg-[var(--px-well)] px-1">X-API-Key</code> request header.
                          The tender website verifies this key before accepting any pothole batch.
                        </p>
                      </div>

                      <div>
                        <label className="ledger mb-2 block text-dim">
                          Automatic Sync Frequency (Between 15 and 30 Days)
                        </label>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {[15, 20, 25, 30].map((days) => (
                            <PixelButton
                              key={days}
                              type="button"
                              variant={intervalDays === days ? "gold" : "default"}
                              onClick={() => setIntervalDays(days)}
                            >
                              {days} Days
                            </PixelButton>
                          ))}
                        </div>

                        <div className="px-well flex items-center gap-3 bg-[var(--px-well)] p-2">
                          <input
                            type="range"
                            min="15"
                            max="30"
                            step="1"
                            value={intervalDays}
                            onChange={(e) => setIntervalDays(Number(e.target.value))}
                            className="flex-1 accent-gold"
                          />
                          <span className="min-w-[60px] text-right font-pixel text-[10px] tnum text-body">
                            {intervalDays} Days
                          </span>
                        </div>
                      </div>

                      <label className="flex cursor-pointer select-none items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => setIsEnabled(e.target.checked)}
                          className="h-4 w-4 accent-gold"
                        />
                        <span className="font-body text-sm text-body">
                          Enable Automated Background Scheduling
                        </span>
                      </label>

                      <div className="flex items-center justify-between gap-2 border-t-2 border-[var(--px-line)] pt-3">
                        <PixelButton type="submit" variant="gold" disabled={syncSaving}>
                          {syncSaving ? (
                            "Saving…"
                          ) : (
                            <>
                              <PixelIcon name="check" size={12} />
                              Save Configuration
                            </>
                          )}
                        </PixelButton>
                        <p className="font-body text-xs text-dim">Changes apply immediately to scheduler.</p>
                      </div>
                    </form>
                  </PixelWindow>

                  {/* Actions & dispatch */}
                  <div className="space-y-3">
                    <PixelWindow title="Manual Trigger" icon="send" className="p-3">
                      <p className="font-body text-xs text-dim">
                        Need to dispatch immediately without waiting for the 15–30 day timer? Trigger an
                        instant sync to push all current verified potholes and tenders to the tender website now.
                      </p>
                      <div className={`mt-3 ${syncPulse ? "px-anim-stamp" : ""}`}>
                        <PixelButton
                          type="button"
                          variant="gold"
                          className="w-full"
                          onClick={handleTriggerSync}
                          disabled={syncTriggering}
                        >
                          <PixelIcon name="send" size={12} />
                          {syncTriggering ? "Transmitting Payload…" : "Sync Now to Tender Website"}
                        </PixelButton>
                      </div>
                    </PixelWindow>

                    <PixelWindow title="What Gets Sent" icon="file" className="p-3">
                      <ul className="list-inside list-disc space-y-1 font-body text-xs text-dim">
                        <li><strong className="text-body">Verified Potholes:</strong> GPS latitude &amp; longitude coordinates.</li>
                        <li><strong className="text-body">Visual Evidence:</strong> Presigned photo download URLs.</li>
                        <li><strong className="text-body">Tender Packages:</strong> Pothole cluster counts &amp; estimated budgets (₹).</li>
                        <li><strong className="text-body">Location:</strong> Mandals, blocks, and road notes.</li>
                      </ul>
                    </PixelWindow>
                  </div>
                </div>

                {/* Sync audit logs */}
                <PixelWindow title="Sync Audit Logs" icon="list" className="p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-body text-xs text-dim">
                      History of periodic and manual transmissions to the tender website
                    </p>
                    <PixelChip>{syncLogs.length} Records</PixelChip>
                  </div>

                  {syncLogs.length === 0 ? (
                    <div className="px-well flex flex-col items-center gap-1 p-6 text-center">
                      <PixelIcon name="clock" size={22} className="text-dim" />
                      <p className="font-body text-xs text-dim">No sync transmissions logged yet.</p>
                      <p className="font-body text-[11px] text-dim">
                        Click &ldquo;Sync Now&rdquo; above to run the initial transmission.
                      </p>
                    </div>
                  ) : (
                    <div className="px-scroll max-h-64 overflow-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b-2 border-[var(--px-line)] text-dim">
                            <th className="ledger px-2 py-2">Timestamp</th>
                            <th className="ledger px-2 py-2">Trigger Source</th>
                            <th className="ledger px-2 py-2">Potholes Sent</th>
                            <th className="ledger px-2 py-2">Tenders Sent</th>
                            <th className="ledger px-2 py-2">Status</th>
                            <th className="ledger px-2 py-2">HTTP Code</th>
                            <th className="ledger px-2 py-2">Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {syncLogs.map((log) => (
                            <tr key={log.id} className="border-b border-[var(--px-line)]">
                              <td className="px-2 py-2 font-mono tnum text-body">
                                {new Date(log.synced_at).toLocaleString()}
                              </td>
                              <td className="px-2 py-2">
                                <PixelChip className="font-mono">{log.triggered_by}</PixelChip>
                              </td>
                              <td className="px-2 py-2 font-pixel text-[10px] tnum text-body">{log.potholes_count}</td>
                              <td className="px-2 py-2 font-pixel text-[10px] tnum text-body">{log.tenders_count}</td>
                              <td className="px-2 py-2">
                                <PixelChip>
                                  <PixelLamp status={log.status === "success" ? "open" : "done"} />
                                  <span className={log.status === "success" ? "text-green" : "text-red"}>
                                    {log.status === "success" ? "Success" : "Failed"}
                                  </span>
                                </PixelChip>
                              </td>
                              <td className="px-2 py-2 font-mono text-dim">
                                {log.response_status ? log.response_status : "—"}
                              </td>
                              <td className="max-w-xs truncate px-2 py-2 text-dim">
                                {log.error_message || "Payload delivered successfully"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </PixelWindow>
              </>
            )}
          </div>
        </div>
      </DotPager>
    </div>
  );
}
