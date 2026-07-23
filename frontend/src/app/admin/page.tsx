"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin, FileText, DollarSign, Loader2, Filter,
  CheckCircle, XCircle, Clock, RefreshCw, Shield,
  Check, X, ChevronRight, Map, Users, AlertTriangle
} from "lucide-react";
import { useStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { AdminReport, Tender, MapCluster, PublicPothole } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getStateBounds, getDistrictBounds } from "@/data/india-locations";
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
  rejected: { label: "Rejected", color: "destructive" },
};

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
  const [reportUpdating, setReportUpdating] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    if (user.role !== "admin") { router.push("/dashboard"); return; }
    fetchAll();
  }, [user]);

  // Compute scoped bounds for the map
  const scopeBounds = (() => {
    if (!user?.admin_scope || !user?.state) return null;
    if (user.admin_scope === "state") return getStateBounds(user.state);
    if (user.admin_scope === "district" && user.district) return getDistrictBounds(user.state, user.district);
    if (user.admin_scope === "mandal" && user.district) return getDistrictBounds(user.state, user.district);
    return null;
  })();

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
                  Review and accept or reject generated tenders
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

                    {/* Accept / Reject buttons — only for open tenders */}
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
                          className="flex-1 h-9 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/30 rounded-lg text-sm"
                          variant="ghost"
                          disabled={tenderLoading === tender.id}
                          onClick={() => handleTenderAction(tender.id, "rejected")}
                        >
                          <X className="w-4 h-4 mr-1.5" /> Reject
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
                        <span className="text-xs text-red-400">Rejected</span>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
