"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  FileText,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building2,
  Search,
  Filter,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Image as ImageIcon,
  ChevronRight,
  X,
  PlusCircle,
  HelpCircle,
  Eye,
  Check,
  Calendar,
  Layers,
  Phone,
  Mail,
  UserCheck
} from "lucide-react";
import type { TenderItem, Pothole, ContractorBid, SyncLogEntry } from "@/lib/tenderStore";

// Dynamically load Leaflet map to avoid SSR issues
const TenderMap = dynamic(() => import("@/components/TenderMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full rounded-xl bg-slate-900 animate-pulse flex items-center justify-center text-slate-500 text-xs">
      Loading interactive map...
    </div>
  ),
});

export default function TenderPortalHome() {
  const [tenders, setTenders] = useState<TenderItem[]>([]);
  const [bids, setBids] = useState<ContractorBid[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [activeView, setActiveView] = useState<"grid" | "map">("grid");

  // Selected Tender for Modal
  const [selectedTender, setSelectedTender] = useState<TenderItem | null>(null);
  const [modalTab, setModalTab] = useState<"details" | "bid" | "bids">("details");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // API Key Specs Modal
  const [showApiModal, setShowApiModal] = useState(false);

  // Bid Form State
  const [bidForm, setBidForm] = useState({
    contractor_name: "",
    company_name: "",
    license_number: "",
    email: "",
    phone: "",
    bid_amount: "",
    estimated_days: "15",
    proposal_notes: "",
  });
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [bidSuccessMsg, setBidSuccessMsg] = useState("");

  const fetchPortalData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tenders");
      if (res.ok) {
        const data = await res.json();
        setTenders(data.tenders || []);
        setSyncLogs(data.sync_logs || []);
        setLastSyncAt(data.last_sync_at);
      }
      const bidsRes = await fetch("/api/bids");
      if (bidsRes.ok) {
        const bidsData = await bidsRes.json();
        setBids(bidsData.bids || []);
      }
    } catch (err) {
      console.error("Failed to load portal data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  // Compute available districts
  const districts = useMemo(() => {
    const set = new Set<string>();
    tenders.forEach((t) => {
      if (t.district) set.add(t.district);
    });
    return Array.from(set).sort();
  }, [tenders]);

  // Filtered tenders
  const filteredTenders = useMemo(() => {
    return tenders.filter((t) => {
      const matchSearch =
        !searchQuery ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.block_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.district && t.district.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.mandal && t.mandal.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchDistrict = districtFilter === "all" || t.district === districtFilter;

      return matchSearch && matchStatus && matchDistrict;
    });
  }, [tenders, searchQuery, statusFilter, districtFilter]);

  // Aggregate stats
  const totalPotholes = tenders.reduce((sum, t) => sum + (t.potholes?.length || t.pothole_count || 0), 0);
  const totalBudget = tenders.reduce((sum, t) => sum + Number(t.estimated_cost || 0), 0);
  const openTendersCount = tenders.filter((t) => t.status === "open").length;

  // All potholes for overall map view
  const allPotholes = useMemo(() => {
    const list: Pothole[] = [];
    tenders.forEach((t) => {
      if (t.potholes) list.push(...t.potholes);
    });
    return list;
  }, [tenders]);

  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTender) return;

    setBidSubmitting(true);
    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...bidForm,
          tender_id: selectedTender.id,
          bid_amount: Number(bidForm.bid_amount),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBids((prev) => [data.bid, ...prev]);
        setBidSuccessMsg("Bid quotation submitted successfully! Tender status updated to Under Review.");
        setBidForm({
          contractor_name: "",
          company_name: "",
          license_number: "",
          email: "",
          phone: "",
          bid_amount: "",
          estimated_days: "15",
          proposal_notes: "",
        });
        setTimeout(() => {
          setBidSuccessMsg("");
          setModalTab("bids");
        }, 2000);
        void fetchPortalData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBidSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col">
      {/* Top Government & Portal Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-semibold text-xs py-1.5 px-4 md:px-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5" />
          <span>Government of Andhra Pradesh • Roads & Buildings Department (R&B)</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[11px]">
          <span>Public Works e-Procurement System</span>
          <span>•</span>
          <span className="font-mono">API Key Sync Channel Active</span>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-30 bg-[#0d1322]/90 backdrop-blur-md border-b border-slate-800/80 px-4 md:px-12 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
            <Layers className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold text-white tracking-tight">
                AP Road Works Tendering Portal
              </h1>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full">
                Contractor Hub
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Crowdsourced Pothole Remediation Packages & Bid Ingestion
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* API Status Indicator */}
          <button
            onClick={() => setShowApiModal(true)}
            className="flex items-center gap-2 text-xs bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="hidden sm:inline font-mono">API Key: Active</span>
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Link back to Pothole Reporter */}
          <a
            href="http://localhost:3000/admin"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pothole Admin</span>
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Hero & Ingestion Status Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-[#11192e] to-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Automated 15–30 Day Pothole Reporter Sync Pipeline</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Pothole Remediation Tender Portal
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Tender packages are auto-compiled from citizen reports, verified by municipal engineers, and synchronized via secure API key every 15 to 30 days. Contractors can inspect GPS coordinates, examine high-resolution damage evidence, and submit bids.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={fetchPortalData}
                disabled={loading}
                className="flex items-center justify-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl font-medium transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh Tenders</span>
              </button>
              <button
                onClick={() => setShowApiModal(true)}
                className="flex items-center justify-center gap-2 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/20"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>API Specs & Key</span>
              </button>
            </div>
          </div>

          {/* Sync Metadata Strip */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Last Pothole Sync Received:{" "}
                <strong className="text-slate-200 font-mono">
                  {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Never"}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>
                Sync Frequency: <strong className="text-slate-200">Every 15–30 Days (Admin Controlled)</strong>
              </span>
              <span>•</span>
              <span>
                Endpoint: <strong className="text-amber-400 font-mono">POST /api/sync</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Aggregate Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Open Tenders</span>
              <FileText className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-3xl font-extrabold text-white">{openTendersCount}</p>
            <p className="text-[11px] text-slate-500 mt-1">Available for bidding</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Total Potholes</span>
              <MapPin className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-3xl font-extrabold text-white">{totalPotholes}</p>
            <p className="text-[11px] text-slate-500 mt-1">Verified with GPS & photos</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Estimated Budget</span>
              <DollarSign className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-2xl md:text-3xl font-extrabold text-white">
              ₹{totalBudget.toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Total repair allocation</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Contractor Bids</span>
              <UserCheck className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-3xl font-extrabold text-white">{bids.length}</p>
            <p className="text-[11px] text-slate-500 mt-1">Proposals submitted</p>
          </div>
        </div>

        {/* View Toggle & Search/Filter Bar */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tender, block, mandal..."
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 pl-9 pr-4 py-2.5 rounded-xl outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* District Filter */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2.5 rounded-xl outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="all">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2.5 rounded-xl outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open for Bidding</option>
              <option value="under_review">Under Review</option>
              <option value="assigned">Assigned</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* View Switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-end md:self-auto">
            <button
              onClick={() => setActiveView("grid")}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                activeView === "grid"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tenders Grid</span>
            </button>
            <button
              onClick={() => setActiveView("map")}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                activeView === "map"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>GIS State Map</span>
            </button>
          </div>
        </div>

        {/* CONTENT VIEW: GRID OR FULL MAP */}
        {activeView === "map" ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Andhra Pradesh Pothole Distribution Map</h3>
                <p className="text-xs text-slate-400">
                  Interactive GIS visualization of all {allPotholes.length} synchronized potholes across active tenders.
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-800 px-3 py-1 rounded-lg text-slate-300">
                {allPotholes.length} Geotagged Potholes
              </span>
            </div>
            <TenderMap potholes={allPotholes} height="560px" zoom={8} />
          </div>
        ) : (
          <div>
            {filteredTenders.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-2xl">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <p className="text-sm font-semibold text-slate-300">No tenders match your criteria</p>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust filters or trigger a sync from the Pothole Reporter Admin Dashboard.
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTenders.map((tender) => {
                  const tenderBids = bids.filter((b) => b.tender_id === tender.id);
                  const potholeCount = tender.potholes?.length || tender.pothole_count || 0;

                  return (
                    <div
                      key={tender.id}
                      className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group hover:shadow-xl hover:shadow-amber-500/5"
                    >
                      <div className="space-y-4">
                        {/* Header: Location & Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-mono text-amber-400 font-semibold uppercase tracking-wider">
                              {tender.district || "AP Region"} • {tender.mandal || "Central"}
                            </span>
                            <h3 className="font-bold text-white text-base group-hover:text-amber-300 transition-colors line-clamp-2">
                              {tender.title}
                            </h3>
                          </div>
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              tender.status === "open"
                                ? "bg-green-500/10 text-green-400 border-green-500/30"
                                : tender.status === "under_review"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            }`}
                          >
                            {tender.status.replace("_", " ")}
                          </span>
                        </div>

                        {/* Description */}
                        {tender.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {tender.description}
                          </p>
                        )}

                        {/* Stats Strip */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase font-medium">Verified Potholes</p>
                            <p className="text-sm font-bold text-slate-200">{potholeCount} Sites</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase font-medium">Estimated Budget</p>
                            <p className="text-sm font-bold text-green-400">
                              ₹{Number(tender.estimated_cost).toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>

                        {/* Pothole Photo Previews */}
                        {tender.potholes && tender.potholes.length > 0 && (
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase font-medium mb-1.5">
                              Damage Evidence Gallery ({tender.potholes.length})
                            </p>
                            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                              {tender.potholes.slice(0, 3).map((p, idx) => (
                                <div
                                  key={p.id || idx}
                                  className="w-16 h-12 rounded-lg bg-slate-800 overflow-hidden border border-slate-700 flex-shrink-0 relative group/img cursor-pointer"
                                  onClick={() => p.image_url && setPreviewImage(p.image_url)}
                                >
                                  {p.image_url ? (
                                    <img
                                      src={p.image_url}
                                      alt="pothole thumbnail"
                                      className="w-full h-full object-cover group-hover/img:scale-110 transition-transform"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-[10px]">
                                      GPS Only
                                    </div>
                                  )}
                                </div>
                              ))}
                              {tender.potholes.length > 3 && (
                                <div className="w-12 h-12 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 text-xs font-mono flex-shrink-0">
                                  +{tender.potholes.length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer & Action Button */}
                      <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                        <div className="text-[11px] text-slate-400">
                          <span>{tenderBids.length} bid(s) placed</span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTender(tender);
                            setModalTab("details");
                          }}
                          className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 hover:border-amber-500 px-3.5 py-1.5 rounded-xl font-semibold transition-all"
                        >
                          <span>Inspect & Bid</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* TENDER INSPECTION & BIDDING MODAL */}
      {selectedTender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-amber-400 font-semibold uppercase">
                    {selectedTender.district} • {selectedTender.mandal}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                      selectedTender.status === "open"
                        ? "bg-green-500/10 text-green-400 border-green-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {selectedTender.status.replace("_", " ")}
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-white">{selectedTender.title}</h2>
                <p className="text-xs text-slate-400 font-mono">Block ID: {selectedTender.block_id}</p>
              </div>
              <button
                onClick={() => setSelectedTender(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Bar */}
            <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-950/30 text-xs font-semibold">
              <button
                onClick={() => setModalTab("details")}
                className={`pb-3 px-2 border-b-2 transition-all ${
                  modalTab === "details"
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Potholes & Evidence ({selectedTender.potholes?.length || selectedTender.pothole_count})
              </button>
              <button
                onClick={() => setModalTab("bid")}
                className={`pb-3 px-2 border-b-2 transition-all ${
                  modalTab === "bid"
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Submit Bid Quotation
              </button>
              <button
                onClick={() => setModalTab("bids")}
                className={`pb-3 px-2 border-b-2 transition-all ${
                  modalTab === "bids"
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Received Bids ({bids.filter((b) => b.tender_id === selectedTender.id).length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {modalTab === "details" && (
                <div className="space-y-6">
                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500 block">Pothole Count</span>
                      <strong className="text-white text-base">
                        {selectedTender.potholes?.length || selectedTender.pothole_count} Sites
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Estimated Cost</span>
                      <strong className="text-green-400 text-base">
                        ₹{Number(selectedTender.estimated_cost).toLocaleString("en-IN")}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Submission Deadline</span>
                      <strong className="text-amber-300 text-base">
                        {selectedTender.deadline
                          ? new Date(selectedTender.deadline).toLocaleDateString()
                          : "20 Days"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Jurisdiction</span>
                      <strong className="text-white text-base">
                        {selectedTender.mandal}, {selectedTender.district}
                      </strong>
                    </div>
                  </div>

                  {/* Interactive Map of This Tender's Potholes */}
                  {selectedTender.potholes && selectedTender.potholes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Geotagged Pothole Coordinates (OpenStreetMap)
                      </h4>
                      <TenderMap potholes={selectedTender.potholes} height="320px" zoom={13} />
                    </div>
                  )}

                  {/* Detailed Pothole Cards List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Visual Evidence & Defect Dossier
                    </h4>

                    {!selectedTender.potholes || selectedTender.potholes.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No individual pothole coordinates loaded.</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {selectedTender.potholes.map((p, idx) => (
                          <div
                            key={p.id || idx}
                            className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex gap-3 items-start"
                          >
                            {p.image_url ? (
                              <div
                                onClick={() => p.image_url && setPreviewImage(p.image_url)}
                                className="w-20 h-20 bg-slate-800 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer border border-slate-700 hover:opacity-80 transition-opacity"
                              >
                                <img
                                  src={p.image_url}
                                  alt="Pothole proof"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-20 h-20 bg-slate-800 rounded-lg flex-shrink-0 flex items-center justify-center text-slate-600 text-[10px] text-center p-1">
                                No Photo
                              </div>
                            )}
                            <div className="flex-1 min-w-0 space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-amber-400">Site #{idx + 1}</span>
                                <span className="text-[10px] bg-green-900/40 text-green-300 px-1.5 py-0.5 rounded font-mono">
                                  {p.status}
                                </span>
                              </div>
                              {p.address_notes && (
                                <p className="text-slate-300 text-[11px] line-clamp-2 leading-relaxed">
                                  {p.address_notes}
                                </p>
                              )}
                              <p className="text-slate-400 font-mono text-[10px]">
                                GPS: {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                              </p>
                              {p.reporter_name && (
                                <p className="text-slate-500 text-[10px]">
                                  Reported by: {p.reporter_name}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {modalTab === "bid" && (
                <form onSubmit={handleBidSubmit} className="space-y-4 max-w-xl mx-auto">
                  <div className="text-center space-y-1 mb-4">
                    <h3 className="font-bold text-white text-base">Submit Contractor Proposal</h3>
                    <p className="text-xs text-slate-400">
                      Official quotation for {selectedTender.title} (Est. ₹
                      {Number(selectedTender.estimated_cost).toLocaleString("en-IN")})
                    </p>
                  </div>

                  {bidSuccessMsg && (
                    <div className="p-3 rounded-xl bg-green-900/40 border border-green-500/50 text-green-300 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span>{bidSuccessMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">Contractor Full Name *</label>
                      <input
                        type="text"
                        required
                        value={bidForm.contractor_name}
                        onChange={(e) => setBidForm({ ...bidForm, contractor_name: e.target.value })}
                        placeholder="e.g. Ramesh Naidu"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Company / Enterprise Name *</label>
                      <input
                        type="text"
                        required
                        value={bidForm.company_name}
                        onChange={(e) => setBidForm({ ...bidForm, company_name: e.target.value })}
                        placeholder="e.g. Apex Infrastructure Pvt Ltd"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">License / R&B Reg ID</label>
                      <input
                        type="text"
                        value={bidForm.license_number}
                        onChange={(e) => setBidForm({ ...bidForm, license_number: e.target.value })}
                        placeholder="e.g. AP-R&B-CL1-2024"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        value={bidForm.email}
                        onChange={(e) => setBidForm({ ...bidForm, email: e.target.value })}
                        placeholder="bids@company.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Contact Phone *</label>
                      <input
                        type="tel"
                        required
                        value={bidForm.phone}
                        onChange={(e) => setBidForm({ ...bidForm, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">Quotation Amount (INR ₹) *</label>
                      <input
                        type="number"
                        required
                        value={bidForm.bid_amount}
                        onChange={(e) => setBidForm({ ...bidForm, bid_amount: e.target.value })}
                        placeholder={`e.g. ${selectedTender.estimated_cost}`}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono font-bold outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Execution Timeline (Days) *</label>
                      <input
                        type="number"
                        required
                        value={bidForm.estimated_days}
                        onChange={(e) => setBidForm({ ...bidForm, estimated_days: e.target.value })}
                        placeholder="15"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="text-xs">
                    <label className="block text-slate-400 mb-1">Methodology & Proposal Notes</label>
                    <textarea
                      rows={3}
                      value={bidForm.proposal_notes}
                      onChange={(e) => setBidForm({ ...bidForm, proposal_notes: e.target.value })}
                      placeholder="Outline asphalt specifications, compaction machinery, warranty duration..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={bidSubmitting}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20"
                  >
                    {bidSubmitting ? "Submitting Proposal..." : "Confirm & Submit Bid to R&B Portal"}
                  </button>
                </form>
              )}

              {modalTab === "bids" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Bids Placed for this Tender
                  </h4>
                  {bids.filter((b) => b.tender_id === selectedTender.id).length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
                      <p className="text-xs text-slate-400">No contractor bids submitted yet.</p>
                      <button
                        onClick={() => setModalTab("bid")}
                        className="mt-2 text-xs text-amber-400 font-semibold underline"
                      >
                        Be the first to submit a bid
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bids
                        .filter((b) => b.tender_id === selectedTender.id)
                        .map((b) => (
                          <div
                            key={b.id}
                            className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1">
                              <p className="font-bold text-white text-sm">{b.company_name}</p>
                              <p className="text-slate-400">
                                Contractor: <strong className="text-slate-200">{b.contractor_name}</strong> • License:{" "}
                                <span className="font-mono">{b.license_number}</span>
                              </p>
                              {b.proposal_notes && (
                                <p className="text-[11px] text-slate-400 italic mt-1">&ldquo;{b.proposal_notes}&rdquo;</p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-base font-extrabold text-green-400">
                                ₹{Number(b.bid_amount).toLocaleString("en-IN")}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {b.estimated_days} Days Timeline
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULL PHOTO PREVIEW MODAL */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/70 text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Full evidence preview"
              className="w-full h-full object-contain max-h-[85vh]"
            />
          </div>
        </div>
      )}

      {/* API KEY & INTEGRATION DOCUMENTATION MODAL */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">Tender Portal API & Sync Specifications</h3>
              </div>
              <button
                onClick={() => setShowApiModal(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs text-slate-300">
              <p className="leading-relaxed">
                This tendering website exposes an authenticated ingestion API that accepts verified pothole reports, high-res photos, and auto-bundled tenders transmitted by the main Pothole Reporter system every 15 to 30 days.
              </p>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 font-mono">
                <p className="text-amber-400 font-bold text-[11px]">API ENDPOINT SPECIFICATION:</p>
                <p className="text-slate-200">
                  <span className="text-green-400 font-bold">POST</span> /api/sync
                  <span className="text-slate-500"> (ingest potholes &amp; tenders)</span>
                </p>
                <p className="text-slate-200">
                  <span className="text-green-400 font-bold">DELETE</span> /api/tenders
                  <span className="text-slate-500"> (withdraw a tender: {"{ tender_id }"})</span>
                </p>
                <p className="text-slate-400">
                  Header: <strong className="text-slate-200">X-API-Key: &lt;configured TENDER_API_KEY&gt;</strong>
                </p>
                <p className="text-slate-400">
                  Header: <strong className="text-slate-200">Content-Type: application/json</strong>
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-1.5">Sample Sync Payload Format:</h4>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
{`{
  "source": "pothole-reporter",
  "exported_at": "${new Date().toISOString()}",
  "triggered_by": "scheduler (15-30 days) or admin",
  "summary": { "total_potholes": 42, "total_tenders": 6 },
  "tenders": [
    {
      "id": "uuid",
      "block_id": "andhra pradesh/visakhapatnam/gajuwaka",
      "pothole_count": 6,
      "estimated_cost": 360000,
      "status": "open"
    }
  ],
  "potholes": [
    {
      "id": "uuid",
      "latitude": 17.6868,
      "longitude": 83.2185,
      "address_notes": "Main road crater",
      "image_url": "https://presigned-s3-url.com/...",
      "block_id": "andhra pradesh/visakhapatnam/gajuwaka",
      "status": "verified"
    }
  ]
}`}
                </pre>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-white">Recent Inbound Synchronizations:</h4>
                {syncLogs.length === 0 ? (
                  <p className="text-slate-500 italic">No sync logs recorded yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {syncLogs.slice(0, 4).map((l) => (
                      <div
                        key={l.id}
                        className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]"
                      >
                        <span className="font-mono text-slate-400">{new Date(l.received_at).toLocaleString()}</span>
                        <span className="font-semibold text-slate-200">
                          {l.potholes_count} Potholes • {l.tenders_count} Tenders
                        </span>
                        <span className="text-green-400 font-mono font-semibold">{l.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 px-4 md:px-12 text-center text-xs text-slate-500 bg-slate-950">
        <p>Andhra Pradesh Road Works & Pothole Repair Tendering System • Powered by Pothole Reporter</p>
        <p className="mt-1 text-[11px] text-slate-600">
          Automated data synchronization every 15–30 days configured via Administrative Portal.
        </p>
      </footer>
    </div>
  );
}
