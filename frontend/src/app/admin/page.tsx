"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, FileText, Users, DollarSign, Loader2, Filter, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, Shield } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { AdminReport, Tender, MapCluster } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import dynamic from "next/dynamic";

const DynamicMap = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-[500px] flex items-center justify-center bg-[var(--color-surface)] rounded-xl"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-primary)]" /></div>,
});

function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(current));
    }, 1500 / steps);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display.toLocaleString()}</span>;
}

const statusBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary", verified: "default", rejected: "destructive", fixed: "outline",
};
const tenderStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "default", assigned: "secondary", completed: "outline",
};

export default function AdminDashboard() {
  const { user, logout } = useStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("map");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [clusters, setClusters] = useState<MapCluster[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0, rejected: 0 });

  useEffect(() => {
    if (!user || user.role !== "admin") { router.push("/"); return; }
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [reportsData, tendersData, mapData] = await Promise.all([api.getAdminReports(), api.getTenders(), api.getMapClusters()]);
      const r = (reportsData.reports || []) as AdminReport[];
      setReports(r);
      setTenders(tendersData.tenders || []);
      setClusters(mapData.blockDensity || []);
      setStats({
        total: r.length,
        verified: r.filter((x) => x.status === "verified").length,
        pending: r.filter((x) => x.status === "pending").length,
        rejected: r.filter((x) => x.status === "rejected").length,
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const filteredReports = statusFilter && statusFilter !== "all" ? reports.filter((r) => r.status === statusFilter) : reports;

  if (!mounted || !user) return null;

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <nav className="flex items-center justify-between p-4 md:px-16 lg:px-24 xl:px-32 md:py-6 w-full border-b border-[var(--color-border)]">
        <a className="flex items-center gap-2" href="/admin">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-text-primary)] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--color-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-bold text-[var(--color-heading)]">Admin</span>
        </a>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)]">
            <Shield className="w-3 h-3" /> Admin
          </span>
          <span className="text-sm text-[var(--color-text-secondary)] hidden sm:block">{user.name}</span>
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => { logout(); router.push("/"); }} className="text-[var(--color-text-secondary)]">Logout</Button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-10">
        <div
          className="text-center mb-10 bg-no-repeat bg-cover bg-center rounded-2xl py-16 px-4 relative overflow-hidden"
          style={{ backgroundImage: "url('https://raw.githubusercontent.com/prebuiltui/prebuiltui/main/assets/hero/gridBackground.png')" }}
        >
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ background: "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.06) 0%, transparent 40%)" }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              if (rect) {
                e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
              }
            }}
          />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 border border-[var(--color-border)] rounded-full px-4 py-1.5 text-xs text-[var(--color-text-secondary)] mb-6 backdrop-blur-sm">
              <Shield className="w-3 h-3" /> Admin Control Panel
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-[var(--color-heading)]">Oversight Dashboard</h1>
            <p className="text-[var(--color-text-secondary)] mt-2">Monitor reports, clusters, and automated tenders.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: MapPin, label: "Total", value: stats.total, color: "text-blue-400", bg: "bg-blue-500/10" },
            { icon: CheckCircle, label: "Verified", value: stats.verified, color: "text-green-400", bg: "bg-green-500/10" },
            { icon: Clock, label: "Pending", value: stats.pending, color: "text-yellow-400", bg: "bg-yellow-500/10" },
            { icon: XCircle, label: "Rejected", value: stats.rejected, color: "text-red-400", bg: "bg-red-500/10" },
          ].map((s) => (
            <Card key={s.label} className="p-4 bg-[var(--color-surface)] border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">{s.label}</p>
                  <p className="text-2xl font-bold text-[var(--color-heading)]"><AnimatedCounter value={s.value} /></p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-[var(--color-surface)] border border-[var(--color-border)]">
            <TabsTrigger value="map" className="gap-2 data-[state=active]:bg-[var(--color-text-primary)] data-[state=active]:text-[var(--color-bg)]">
              <MapPin className="w-4 h-4" /> Map
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 data-[state=active]:bg-[var(--color-text-primary)] data-[state=active]:text-[var(--color-bg)]">
              <Users className="w-4 h-4" /> Reports
            </TabsTrigger>
            <TabsTrigger value="tenders" className="gap-2 data-[state=active]:bg-[var(--color-text-primary)] data-[state=active]:text-[var(--color-bg)]">
              <DollarSign className="w-4 h-4" /> Tenders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-primary)]" /></div>
            ) : (
              <>
                <DynamicMap clusters={clusters} />
                {clusters.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[...clusters].sort((a, b) => b.count - a.count).map((c) => (
                      <Card key={c.block_id} className="p-4 bg-[var(--color-surface)] border-[var(--color-border)]">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs text-[var(--color-text-secondary)] font-mono mb-1">{c.block_id}</p>
                            <p className="text-3xl font-bold text-[var(--color-heading)]">{c.count}</p>
                            <p className="text-sm text-[var(--color-text-secondary)]">Verified</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[var(--color-text-secondary)]">Est. cost</p>
                            <p className="text-lg font-bold text-green-400">${(c.count * 150).toLocaleString()}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-[var(--color-text-secondary)]" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "")}>
                <SelectTrigger className="w-40 bg-[var(--color-surface)] border-[var(--color-border)]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchAll} className="border-[var(--color-border)] ml-auto">
                <RefreshCw className="w-4 h-4" /> Refresh
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-20 text-[var(--color-text-secondary)] border border-dashed border-[var(--color-border)] rounded-2xl">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No reports found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((r) => (
                  <Card key={r.id} className="p-4 bg-[var(--color-surface)] border-[var(--color-border)]">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--color-text-primary)]/10 flex items-center justify-center text-[var(--color-text-primary)] font-bold text-sm">
                          {r.reporter_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--color-heading)]">{r.reporter_name}</p>
                          <p className="text-xs text-[var(--color-text-secondary)]">{r.reporter_phone || "No phone"}</p>
                        </div>
                      </div>
                      <Badge variant={statusBadgeVariant[r.status] || "secondary"}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2 text-sm text-[var(--color-text-secondary)] mb-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="font-mono text-xs">{Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}</span>
                      </div>
                      {r.block_id && (
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                          <span className="font-mono text-xs">{r.block_id}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs">{new Date(r.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    {r.image_url && <img src={r.image_url} alt="" className="mt-2 rounded-lg max-h-48 w-full object-cover border border-[var(--color-border)]" />}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tenders">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>
            ) : tenders.length === 0 ? (
              <div className="text-center py-20 text-[var(--color-text-secondary)] border border-dashed border-[var(--color-border)] rounded-2xl">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No tenders yet</p>
                <p className="text-xs mt-1">Tenders appear when a block reaches the threshold.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {tenders.map((t) => (
                  <Card key={t.id} className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-[var(--color-heading)]">Block {t.block_id}</h3>
                          <Badge variant={tenderStatusVariant[t.status] || "default"}>{t.status.charAt(0).toUpperCase() + t.status.slice(1)}</Badge>
                        </div>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          Generated {new Date(t.generated_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6 mb-4">
                      <div className="bg-[var(--color-bg)] rounded-xl p-4 text-center">
                        <p className="text-xs text-[var(--color-text-secondary)] uppercase mb-1">Potholes</p>
                        <p className="text-3xl font-bold text-[var(--color-heading)]">{t.pothole_count}</p>
                      </div>
                      <div className="bg-[var(--color-bg)] rounded-xl p-4 text-center">
                        <p className="text-xs text-[var(--color-text-secondary)] uppercase mb-1">Cost</p>
                        <p className="text-3xl font-bold text-green-400">${Number(t.estimated_cost).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (t.pothole_count / 20) * 100)}%` }}
                        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-[var(--color-text-primary)] to-blue-400 rounded-full"
                      />
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-2 text-right font-mono">{t.pothole_count}/20 threshold</p>
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
