"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin, FileText, DollarSign, Loader2, Filter,
  CheckCircle, XCircle, Clock, RefreshCw, Shield,
  Check, X, ChevronRight, Map, Users, AlertTriangle,
  Send, ExternalLink, Key, Eye, EyeOff, Calendar, Save, Play, CheckCheck, Globe
} from "lucide-react";
import { useStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { AdminReport, Tender, MapCluster, PublicPothole, TenderSyncConfig, TenderSyncLog } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ANDHRA_STATE, getFallbackDistricts, getFallbackSubdistricts } from "@/data/andhraDirectory";
import type { AdministrativeArea, MapBoundingBox } from "@/types";
import dynamic from "next/dynamic";

const DynamicMap = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-[500px] w-full rounded-lg bg-[var(--color-muted)] animate-pulse border border-[var(--color-border)]" />,
});
const PublicMiniMap = dynamic(() => import("@/components/PublicMiniMap"), { ssr: false });

const statusColors: Record<string, string> = {
  pending: "text-amber-500",
  verified: "text-green-500",
  rejected: "text-red-400",
  fixed: "text-indigo-400",
};

const statusIcons: Record<string, ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  verified: <CheckCircle className="w-4 h-4" />,
  rejected: <XCircle className="w-4 h-4" />,
  fixed: <CheckCircle className="w-4 h-4" />,
};

const tenderStatusBadge: Record<string, { label: string; color: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", color: "secondary" },
  assigned: { label: "Accepted", color: "default" },
  completed: { label: "Completed", color: "outline" },
  rejected: { label: "Withdrawn", color: "destructive" },
};

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
    <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-full px-3 py-1">
      <Shield className="w-3 h-3" />
      <span>{scopeText} Admin</span>
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

  // Stats
  const stats = {
    total: reports.length,
    verified: reports.filter((r) => r.status === "verified").length,
    pending: reports.filter((r) => r.status === "pending").length,
    fixed: reports.filter((r) => r.status === "fixed").length,
    openTenders: tenders.filter((t) => t.status === "open").length,
    assignedTenders: tenders.filter((t) => t.status === "assigned").length,
  };

  if (!mounted || !user) return null;

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Navbar */}
      <nav className="flex items-center justify-between p-4 md:px-12 md:py-5 w-full border-b border-[var(--color-border)] sticky top-0 z-40 bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-text-primary)] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--color-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-bold text-[var(--color-heading)]">Admin Panel</span>
          <ScopeLabel user={user} />
        </div>
        <div className="flex items-center gap-3">
          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors font-medium"
            title="Open dedicated Tender & Contractor Website"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tender Website</span> ↗
          </a>
          <span className="text-sm text-[var(--color-text-secondary)] hidden sm:block">{user.name}</span>
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => { void logout().finally(() => router.push("/")); }} className="text-[var(--color-text-secondary)]">
            Logout
          </Button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Success toast */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-green-900/80 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-xl shadow-xl backdrop-blur-sm"
            >
              <CheckCircle className="w-4 h-4" /> {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Total Reports", value: stats.total, icon: <FileText className="w-4 h-4" />, color: "text-blue-400" },
            { label: "Verified", value: stats.verified, icon: <CheckCircle className="w-4 h-4" />, color: "text-green-500" },
            { label: "Pending", value: stats.pending, icon: <Clock className="w-4 h-4" />, color: "text-amber-500" },
            { label: "Fixed", value: stats.fixed, icon: <CheckCircle className="w-4 h-4" />, color: "text-indigo-400" },
            { label: "Open Tenders", value: stats.openTenders, icon: <FileText className="w-4 h-4" />, color: "text-orange-400" },
            { label: "Accepted", value: stats.assignedTenders, icon: <DollarSign className="w-4 h-4" />, color: "text-purple-400" },
          ].map(({ label, value, icon, color }) => (
            <Card key={label} className="p-4 bg-[var(--color-surface)] border-[var(--color-border)]">
              <div className={`flex items-center gap-1.5 mb-2 ${color}`}>{icon}<span className="text-xs text-[var(--color-text-secondary)]">{label}</span></div>
              <p className="text-2xl font-bold text-[var(--color-heading)]">{value}</p>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="map" className="w-full">
          <TabsList className="mb-6 bg-[var(--color-surface)] border border-[var(--color-border)]">
            <TabsTrigger value="map"><Map className="w-4 h-4 mr-2" />Map View</TabsTrigger>
            <TabsTrigger value="reports"><FileText className="w-4 h-4 mr-2" />Reports</TabsTrigger>
            <TabsTrigger value="tenders"><DollarSign className="w-4 h-4 mr-2" />Tenders</TabsTrigger>
            <TabsTrigger value="integration"><Send className="w-4 h-4 mr-2" />Tender Sync (15–30 Days)</TabsTrigger>
          </TabsList>

          {/* MAP TAB */}
          <TabsContent value="map">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-heading)] mb-1">
                Pothole Distribution
                {scopeBounds && (
                  <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-2">
                    — bounded to {user.admin_scope} level
                  </span>
                )}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Showing {publicPotholes.length} potholes with {clusters.length} block clusters
              </p>
            </div>
            {loadingMap ? (
              <div className="h-[500px] rounded-lg bg-[var(--color-muted)] animate-pulse border border-[var(--color-border)]" />
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
          </TabsContent>

          {/* REPORTS TAB */}
          <TabsContent value="reports">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-[var(--color-heading)]">All Reports</h2>
              <div className="flex items-center gap-3">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
                  <SelectTrigger className="w-40 bg-[var(--color-surface)] border-[var(--color-border)]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={fetchAll} className="text-[var(--color-text-secondary)]">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-primary)]" /></div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-[var(--color-border)] rounded-2xl">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-secondary)] opacity-40" />
                <p className="text-[var(--color-text-secondary)]">No reports found</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredReports.map((report) => (
                  <Card key={report.id} className="p-4 bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-text-primary)]/30 transition-colors">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`flex items-center gap-1 text-xs font-medium ${statusColors[report.status]}`}>
                            {statusIcons[report.status]} {report.status}
                          </span>
                          {report.block_id && (
                            <span className="text-xs font-mono text-[var(--color-text-secondary)] bg-[var(--color-muted)] px-2 py-0.5 rounded">
                              {report.block_id}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                          <Users className="w-3 h-3 inline mr-1" />
                          {report.reporter_name} • {report.reporter_phone || "No phone"}
                        </p>
                        {report.address_notes && (
                          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mb-1">{report.address_notes}</p>
                        )}
                        <p className="text-xs text-[var(--color-text-secondary)] font-mono">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {Number(report.latitude).toFixed(5)}, {Number(report.longitude).toFixed(5)}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                          {new Date(report.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                        </p>
                      </div>
                      {/* Quick actions for pending reports */}
                      {report.status === "pending" && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleReportStatus(report.id, "verified")}
                            disabled={reportUpdating === report.id}
                            className="h-8 px-3 bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-500/30 rounded-lg"
                            variant="ghost"
                          >
                            {reportUpdating === report.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />Verify</>}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleReportStatus(report.id, "rejected")}
                            disabled={reportUpdating === report.id}
                            className="h-8 px-3 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/30 rounded-lg"
                            variant="ghost"
                          >
                            <X className="w-3 h-3 mr-1" />Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TENDERS TAB */}
          <TabsContent value="tenders">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-heading)]">Tenders</h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Review tenders — accept them or unsend to remove from the tendering website
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchAll} className="text-[var(--color-text-secondary)]">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-primary)]" /></div>
            ) : tenders.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-[var(--color-border)] rounded-2xl">
                <FileText className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-secondary)] opacity-40" />
                <p className="text-[var(--color-text-secondary)]">No tenders yet</p>
                <p className="text-xs text-[var(--color-text-secondary)] opacity-70 mt-1">Tenders are auto-generated when pothole threshold is met</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tenders.map((tender) => (
                  <Card key={tender.id} className="p-5 bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-text-primary)]/30 transition-colors flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-mono text-[var(--color-text-secondary)] mb-1">{tender.block_id}</p>
                        <p className="text-lg font-bold text-[var(--color-heading)]">
                          ₹{Number(tender.estimated_cost).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <Badge variant={tenderStatusBadge[tender.status]?.color || "secondary"}>
                        {tenderStatusBadge[tender.status]?.label || tender.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-[var(--color-muted)] rounded-lg p-2.5">
                        <p className="text-xs text-[var(--color-text-secondary)]">Potholes</p>
                        <p className="font-semibold text-[var(--color-heading)]">{tender.pothole_count}</p>
                      </div>
                      <div className="bg-[var(--color-muted)] rounded-lg p-2.5">
                        <p className="text-xs text-[var(--color-text-secondary)]">Generated</p>
                        <p className="font-semibold text-[var(--color-heading)] text-xs">
                          {new Date(tender.generated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Accept / Unsend buttons — only for open tenders.
                        Unsend withdraws the tender from the tendering website. */}
                    {tender.status === "open" && (
                      <div className="flex gap-2 mt-auto pt-2 border-t border-[var(--color-border)]">
                        <Button
                          className="flex-1 h-9 bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-500/30 rounded-lg text-sm"
                          variant="ghost"
                          disabled={tenderLoading === tender.id}
                          onClick={() => handleTenderAction(tender.id, "assigned")}
                        >
                          {tenderLoading === tender.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <><Check className="w-4 h-4 mr-1.5" /> Accept</>
                          )}
                        </Button>
                        <Button
                          className={`flex-1 h-9 rounded-lg text-sm border transition-colors ${
                            withdrawConfirmId === tender.id
                              ? "bg-red-600/60 hover:bg-red-600/80 text-white border-red-400/50"
                              : "bg-red-900/30 hover:bg-red-900/50 text-red-400 border-red-500/30"
                          }`}
                          variant="ghost"
                          disabled={tenderLoading === tender.id}
                          onClick={() => handleTenderWithdraw(tender.id)}
                        >
                          {tenderLoading === tender.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : withdrawConfirmId === tender.id ? (
                            <><AlertTriangle className="w-4 h-4 mr-1.5" /> Confirm Unsend</>
                          ) : (
                            <><Send className="w-4 h-4 mr-1.5 rotate-180" /> Unsend</>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Completed tenders can be marked back if needed */}
                    {tender.status === "assigned" && (
                      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-[var(--color-border)]">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-green-500">Accepted — pending completion</span>
                      </div>
                    )}

                    {tender.status === "rejected" && (
                      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-[var(--color-border)]">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span className="text-xs text-red-400">Withdrawn — removed from tendering website</span>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TENDER INTEGRATION & SCHEDULER TAB */}
          <TabsContent value="integration">
            {!isStateAdmin && (
              <div className="mb-6 p-4 rounded-xl border border-amber-500/40 bg-amber-900/20 flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">State admin access only</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                    Tender website integration, API keys and the 15–30 day sync schedule are managed exclusively by state-level administrators. Your jurisdiction (mandal/district) does not include this configuration.
                  </p>
                </div>
              </div>
            )}
            {isStateAdmin && (<>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-heading)] flex items-center gap-2">
                  <Globe className="w-5 h-5 text-amber-500" />
                  Tender Website Integration & Periodic Sync
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Automatically export verified potholes, high-res photos, and GPS coordinates to the contractor tender website via API key every 15 to 30 days.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSyncConfig}
                  disabled={syncLoading}
                  className="text-xs border-[var(--color-border)]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <a
                  href="http://localhost:3001"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold px-3 py-2 rounded-lg transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Tender Website
                </a>
              </div>
            </div>

            {/* Notification alert */}
            {syncFeedback && (
              <div
                className={`mb-6 p-4 rounded-xl border flex items-center justify-between ${
                  syncFeedback.type === "success"
                    ? "bg-green-900/30 border-green-500/40 text-green-300"
                    : "bg-red-900/30 border-red-500/40 text-red-300"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {syncFeedback.type === "success" ? <CheckCircle className="w-4 h-4 text-green-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                  <span>{syncFeedback.text}</span>
                </div>
                <button
                  onClick={() => setSyncFeedback(null)}
                  className="text-xs opacity-70 hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Status Summary Banner */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4 bg-[var(--color-surface)] border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">Integration Status</p>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isEnabled ? "bg-green-500 animate-pulse" : "bg-zinc-500"}`} />
                  <span className="font-semibold text-[var(--color-heading)]">{isEnabled ? "Active & Scheduled" : "Sync Disabled"}</span>
                </div>
              </Card>
              <Card className="p-4 bg-[var(--color-surface)] border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">Sync Cycle</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-[var(--color-heading)]">Every {intervalDays} Days</span>
                </div>
              </Card>
              <Card className="p-4 bg-[var(--color-surface)] border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">Next Scheduled Dispatch</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-[var(--color-heading)] text-sm">
                    {syncConfig?.next_sync_at
                      ? new Date(syncConfig.next_sync_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Pending setup"}
                  </span>
                </div>
              </Card>
              <Card className="p-4 bg-[var(--color-surface)] border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">Last Sync Result</p>
                <div className="flex items-center gap-2">
                  <Badge variant={syncConfig?.last_sync_status === "success" ? "default" : syncConfig?.last_sync_status === "failed" ? "destructive" : "secondary"}>
                    {syncConfig?.last_sync_status === "success" ? "Delivered" : syncConfig?.last_sync_status === "failed" ? "Failed" : "Idle"}
                  </Badge>
                  {syncConfig?.last_sync_at && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {new Date(syncConfig.last_sync_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Configuration Form (Left 2 cols) */}
              <Card className="lg:col-span-2 p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
                <div className="flex items-center justify-between mb-4 border-b border-[var(--color-border)] pb-3">
                  <div>
                    <h3 className="font-semibold text-[var(--color-heading)]">Configuration & Schedule</h3>
                    <p className="text-xs text-[var(--color-text-secondary)]">Configure destination tender API endpoint, security credentials, and frequency.</p>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">Admin Managed</Badge>
                </div>

                <form onSubmit={handleSaveSyncConfig} className="space-y-5">
                  <div>
                    <Label htmlFor="targetUrl" className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">
                      Tender Website Ingestion Endpoint URL
                    </Label>
                    <Input
                      id="targetUrl"
                      type="url"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="http://localhost:3001/api/sync"
                      required
                      className="bg-[var(--color-bg)] border-[var(--color-border)] text-sm font-mono"
                    />
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                      The tender portal route that accepts HTTP POST with JSON pothole & tender payload.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor="apiKey" className="text-xs text-[var(--color-text-secondary)]">
                        API Key (Authentication Secret)
                      </Label>
                      <button
                        type="button"
                        onClick={handleGenerateApiKey}
                        className="text-[11px] text-amber-500 hover:text-amber-400 underline font-medium"
                      >
                        Generate New Key
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="apiKey"
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter secret API key shared with tender website"
                        required
                        className="bg-[var(--color-bg)] border-[var(--color-border)] text-sm font-mono pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-2.5 text-[var(--color-text-secondary)] hover:text-[var(--color-heading)]"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                      Sent in the <code className="bg-[var(--color-muted)] px-1 rounded">X-API-Key</code> request header. The tender website verifies this key before accepting any pothole batch.
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs text-[var(--color-text-secondary)] mb-2 block">
                      Automatic Sync Frequency (Between 15 and 30 Days)
                    </Label>
                    <div className="flex items-center gap-2 mb-3">
                      {[15, 20, 25, 30].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setIntervalDays(days)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            intervalDays === days
                              ? "bg-[var(--color-text-primary)] text-[var(--color-bg)] border-[var(--color-text-primary)] font-bold"
                              : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-text-primary)]/50"
                          }`}
                        >
                          Every {days} Days
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 bg-[var(--color-bg)] p-3 rounded-lg border border-[var(--color-border)]">
                      <input
                        type="range"
                        min="15"
                        max="30"
                        step="1"
                        value={intervalDays}
                        onChange={(e) => setIntervalDays(Number(e.target.value))}
                        className="flex-1 accent-amber-500 cursor-pointer"
                      />
                      <span className="font-mono text-sm font-semibold text-[var(--color-heading)] min-w-[70px] text-right">
                        {intervalDays} Days
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => setIsEnabled(e.target.checked)}
                        className="rounded border-[var(--color-border)] accent-amber-500 w-4 h-4"
                      />
                      <span className="text-sm font-medium text-[var(--color-heading)]">
                        Enable Automated Background Scheduling
                      </span>
                    </label>
                  </div>

                  <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
                    <Button
                      type="submit"
                      disabled={syncSaving}
                      className="bg-amber-500 hover:bg-amber-600 text-black font-semibold h-9 px-4 text-xs rounded-lg"
                    >
                      {syncSaving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5 mr-1.5" />
                          Save Configuration
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-[var(--color-text-secondary)]">Changes apply immediately to scheduler.</p>
                  </div>
                </form>
              </Card>

              {/* Actions & Dispatch Panel (Right 1 col) */}
              <div className="space-y-4">
                <Card className="p-5 bg-[var(--color-surface)] border-[var(--color-border)] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-amber-400">
                      <Play className="w-4 h-4" />
                      <h4 className="font-semibold text-sm text-[var(--color-heading)]">Manual Trigger</h4>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mb-4 leading-relaxed">
                      Need to dispatch immediately without waiting for the 15–30 day timer? Trigger an instant sync to push all current verified potholes and tenders to the tender website now.
                    </p>
                  </div>

                  <Button
                    onClick={handleTriggerSync}
                    disabled={syncTriggering}
                    className="w-full bg-[var(--color-text-primary)] text-[var(--color-bg)] font-semibold h-10 rounded-lg text-xs hover:opacity-90"
                  >
                    {syncTriggering ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Transmitting Payload...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Sync Now to Tender Website
                      </>
                    )}
                  </Button>
                </Card>

                <Card className="p-5 bg-[var(--color-surface)] border-[var(--color-border)]">
                  <div className="flex items-center gap-2 mb-2 text-blue-400">
                    <Globe className="w-4 h-4" />
                    <h4 className="font-semibold text-sm text-[var(--color-heading)]">What Gets Sent</h4>
                  </div>
                  <ul className="text-xs text-[var(--color-text-secondary)] space-y-2 mt-2 list-disc list-inside">
                    <li><strong className="text-[var(--color-heading)]">Verified Potholes:</strong> GPS latitude & longitude coordinates.</li>
                    <li><strong className="text-[var(--color-heading)]">Visual Evidence:</strong> Presigned photo download URLs.</li>
                    <li><strong className="text-[var(--color-heading)]">Tender Packages:</strong> Pothole cluster counts & estimated budgets (₹).</li>
                    <li><strong className="text-[var(--color-heading)]">Location:</strong> Mandals, blocks, and road notes.</li>
                  </ul>
                </Card>
              </div>
            </div>

            {/* Sync Audit Logs Table */}
            <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold text-[var(--color-heading)] text-sm">Sync Audit Logs</h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">History of periodic and manual transmissions to the tender website</p>
                </div>
                <Badge variant="outline" className="text-xs font-mono">{syncLogs.length} Records</Badge>
              </div>

              {syncLogs.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-[var(--color-border)] rounded-xl">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-[var(--color-text-secondary)] opacity-40" />
                  <p className="text-xs text-[var(--color-text-secondary)]">No sync transmissions logged yet.</p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] opacity-70 mt-0.5">Click &ldquo;Sync Now&rdquo; above to run the initial transmission.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                        <th className="py-2.5 px-3 font-medium">Timestamp</th>
                        <th className="py-2.5 px-3 font-medium">Trigger Source</th>
                        <th className="py-2.5 px-3 font-medium">Potholes Sent</th>
                        <th className="py-2.5 px-3 font-medium">Tenders Sent</th>
                        <th className="py-2.5 px-3 font-medium">Status</th>
                        <th className="py-2.5 px-3 font-medium">HTTP Code</th>
                        <th className="py-2.5 px-3 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {syncLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[var(--color-muted)]/50 transition-colors">
                          <td className="py-3 px-3 font-mono text-[var(--color-heading)]">
                            {new Date(log.synced_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 font-mono">
                            <span className="bg-[var(--color-muted)] px-2 py-0.5 rounded text-[11px]">
                              {log.triggered_by}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-[var(--color-heading)]">{log.potholes_count}</td>
                          <td className="py-3 px-3 font-semibold text-[var(--color-heading)]">{log.tenders_count}</td>
                          <td className="py-3 px-3">
                            <Badge variant={log.status === "success" ? "default" : "destructive"}>
                              {log.status === "success" ? "Success" : "Failed"}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 font-mono text-[var(--color-text-secondary)]">
                            {log.response_status ? log.response_status : "—"}
                          </td>
                          <td className="py-3 px-3 text-[var(--color-text-secondary)] max-w-xs truncate">
                            {log.error_message || "Payload delivered successfully"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            </>)}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
