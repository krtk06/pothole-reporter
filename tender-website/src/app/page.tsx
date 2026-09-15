"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ExternalLink,
  Hash,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Counter,
  Field,
  Ignition,
  Input,
  Logo,
  MagneticButton,
  NavBar,
  NavInner,
  NavSpacer,
  Pill,
  type PillTone,
  Reveal,
  SandHero,
  Select,
  Surface,
  Textarea,
  ThemeToggle,
  useTheme,
} from "@/components/macadam";
import { sanitizeTenders } from "@/lib/liveSource";
import type { TenderItem, Pothole, ContractorBid, SyncLogEntry } from "@/lib/tenderStore";

const TenderMap = dynamic(() => import("@/components/TenderMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-sunken">
      <span className="font-mono text-xs text-ink3">Loading interactive map…</span>
    </div>
  ),
});

const TENDER_TONE: Record<string, PillTone> = {
  open: "ok",
  under_review: "warn",
  assigned: "info",
  completed: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open for bidding",
  under_review: "Under review",
  assigned: "Assigned",
  completed: "Completed",
};

export default function TenderPortalHome() {
  const { theme, toggleTheme } = useTheme();

  const [tenders, setTenders] = useState<TenderItem[]>([]);
  const [bids, setBids] = useState<ContractorBid[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<{
    backend_reachable: boolean;
    source: string;
    fetched_at: string | null;
    error?: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [activeView, setActiveView] = useState<"grid" | "map">("grid");

  const [selectedTender, setSelectedTender] = useState<TenderItem | null>(null);
  const [modalTab, setModalTab] = useState<"details" | "bid" | "bids">("details");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showApiModal, setShowApiModal] = useState(false);

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
  const [stampFx, setStampFx] = useState(false);

  const fetchPortalData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch("/api/tenders", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTenders(sanitizeTenders(data.tenders || []));
        setSyncLogs(data.sync_logs || []);
        setLastSyncAt(data.last_sync_at);
        setLive(data.live || null);
        if (Array.isArray(data.bids)) setBids(data.bids);
      }
      const bidsRes = await fetch("/api/bids", { cache: "no-store" });
      if (bidsRes.ok) {
        const bidsData = await bidsRes.json();
        if (Array.isArray(bidsData.bids)) setBids(bidsData.bids);
      }
    } catch (err) {
      console.error("Failed to load portal data", err);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
    const interval = setInterval(() => fetchPortalData(true), 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchPortalData(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (previewImage) setPreviewImage(null);
      else if (showApiModal) setShowApiModal(false);
      else if (selectedTender) setSelectedTender(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewImage, showApiModal, selectedTender]);

  const districts = useMemo(() => {
    const set = new Set<string>();
    tenders.forEach((t) => {
      if (t.district) set.add(t.district);
    });
    return Array.from(set).sort();
  }, [tenders]);

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

  const totalPotholes = tenders.reduce((sum, t) => sum + (t.potholes?.length || t.pothole_count || 0), 0);
  const totalBudget = tenders.reduce((sum, t) => sum + Number(t.estimated_cost || 0), 0);
  const openTendersCount = tenders.filter((t) => t.status === "open").length;

  const allPotholes = useMemo(() => {
    const list: Pothole[] = [];
    tenders.forEach((t) => {
      if (t.potholes) list.push(...t.potholes);
    });
    return list;
  }, [tenders]);

  const selectedRank = selectedTender
    ? filteredTenders.findIndex((t) => t.id === selectedTender.id) + 1
    : 0;

  const selectedBids = selectedTender
    ? bids.filter((b) => b.tender_id === selectedTender.id)
    : [];

  const inspectTender = (tender: TenderItem) => {
    setSelectedTender(tender);
    setModalTab("details");
  };

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
        setStampFx(true);
        setTimeout(() => setStampFx(false), 400);
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

  const readings = [
    { label: "Open tenders", value: openTendersCount, tone: "ok" as PillTone, icon: Wallet, isCurrency: false },
    { label: "Total potholes", value: totalPotholes, tone: "warn" as PillTone, icon: MapPin, isCurrency: false },
    { label: "Estimated budget", value: totalBudget, tone: "accent" as PillTone, icon: Wallet, isCurrency: true },
    { label: "Contractor bids", value: bids.length, tone: "info" as PillTone, icon: Users, isCurrency: false },
  ];

  return (
    <MotionConfig reducedMotion="user">
    <main className="min-h-dvh">
      {/* Sync status strip */}
      <div className="border-b border-hairline bg-raise">
        <div
          className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink3 sm:px-6"
          aria-label="Synchronization status"
        >
          <span className="flex items-center gap-1.5 text-ink">
            <Building2 className="h-3 w-3 text-signal" />
            Govt of AP • R&amp;B
          </span>
          <span className="hidden md:inline">Public Works e-Procurement</span>
          <Pill
            tone={live == null ? "neutral" : live.backend_reachable ? "ok" : "warn"}
            pulse={live?.backend_reachable ?? false}
            className="!py-0.5 !text-[10px]"
          >
            {live == null
              ? "Connecting…"
              : live.backend_reachable
              ? "Live — backend (Postgres + AWS S3)"
              : "Offline — last synced cache"}
          </Pill>
          <span className="hidden lg:inline">
            Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Never"}
          </span>
          <span className="hidden xl:inline">Every 15–30 days</span>
          <span className="hidden font-mono text-signal sm:inline">POST /API/SYNC</span>
        </div>
      </div>

      <NavBar>
        <NavInner>
          <Logo src="/brand/tendering.png" name="AP Road Works" tagline="Tendering Portal" />
          <NavSpacer />
          <MagneticButton
            variant="secondary"
            onClick={() => fetchPortalData()}
            disabled={loading}
            className="hidden sm:inline-flex"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </MagneticButton>
          <MagneticButton variant="secondary" onClick={() => setShowApiModal(true)}>
            <span className="dot-pulse h-1.5 w-1.5 rounded-full bg-ok" />
            <span className="hidden sm:inline">API key</span>
            <HelpCircle className="h-4 w-4" />
          </MagneticButton>
          <a
            href="http://localhost:3000/admin"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sunken lg:inline-flex"
          >
            <ExternalLink className="h-4 w-4" />
            Pothole admin
          </a>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </NavInner>
      </NavBar>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-hairline">
        <div className="pointer-events-none absolute inset-0">
          <SandHero className="h-full w-full" />
        </div>
        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <Ignition step={110}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink3">
              Andhra Pradesh • Roads &amp; Buildings
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.4rem,5.4vw,4.25rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink">
              Road repair tenders, open for bidding.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink2">
              Verified pothole packages synchronised from the field every 15 to 30 days — with photo
              evidence, GPS, and budgets attached to every tender.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <MagneticButton
                variant="primary"
                onClick={() =>
                  document.getElementById("board")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Browse the board
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>
              <MagneticButton variant="secondary" onClick={() => setShowApiModal(true)}>
                Integration spec
              </MagneticButton>
            </div>
          </Ignition>
        </div>
      </section>

      {/* Readings */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {readings.map((reading, index) => (
            <Reveal key={reading.label} delay={index * 60}>
              <Surface level={1} className="h-full">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-mono text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                    {reading.isCurrency ? (
                      <>₹<Counter value={reading.value} /></>
                    ) : (
                      <Counter value={reading.value} />
                    )}
                  </p>
                  <reading.icon className="h-4 w-4 shrink-0 text-ink3" />
                </div>
                <div className="mt-3">
                  <Pill tone={reading.tone}>{reading.label}</Pill>
                </div>
              </Surface>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Board */}
      <section id="board" className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 pb-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink">
              <Wallet className="h-5 w-5 text-signal" />
              Tender board
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-ink2">
              Ranked by publication. Inspect the evidence dossier or submit a quotation directly.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-hairline bg-sunken p-1">
            {(
              [
                ["grid", "Board", LayoutGrid],
                ["map", "State map", MapIcon],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveView(key)}
                aria-pressed={activeView === key}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                  activeView === key ? "bg-surface text-ink shadow-1" : "text-ink2 hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink3" />
            <input
              type="text"
              aria-label="Search tender, block, mandal"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tender, block, or mandal…"
              className="h-11 w-full rounded-lg border border-hairline bg-sunken pl-10 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink3 focus:border-signal"
            />
          </div>
          <Select
            aria-label="Filter by district"
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="h-11"
          >
            <option value="all">All districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11"
          >
            <option value="all">All statuses</option>
            <option value="open">Open for bidding</option>
            <option value="under_review">Under review</option>
            <option value="assigned">Assigned</option>
            <option value="completed">Completed</option>
          </Select>
        </div>

        <div className="mt-6">
          {activeView === "map" ? (
            <Surface level={2} padded={false} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
                <h3 className="font-display text-base font-bold text-ink">
                  Andhra Pradesh pothole distribution
                </h3>
                <Pill tone="neutral" mono>
                  {allPotholes.length} geotagged
                </Pill>
              </div>
              <div className="h-[560px]">
                <TenderMap potholes={allPotholes} height="100%" zoom={8} />
              </div>
            </Surface>
          ) : loading ? (
            <Surface level={1} className="flex flex-col items-center gap-2 py-16 text-center">
              <RefreshCw className="h-6 w-6 animate-spin text-ink3" />
              <p className="font-mono text-sm text-ink2">Fetching live tenders…</p>
              <p className="text-xs text-ink3">
                Pulling the latest packages from the backend (Postgres + AWS S3).
              </p>
            </Surface>
          ) : filteredTenders.length === 0 ? (
            <Surface level={1} className="flex flex-col items-center gap-3 py-16 text-center">
              <Wallet className="h-7 w-7 text-ink3" />
              <p className="font-display text-base font-bold text-ink">
                {tenders.length === 0 ? "No tenders available" : "No tenders match your criteria"}
              </p>
              <p className="max-w-md text-sm text-ink2">
                {tenders.length === 0
                  ? "There are currently no road-work tenders published. New packages appear here automatically via secure sync."
                  : "Adjust the filters, or trigger a sync from the Pothole Reporter admin dashboard."}
              </p>
              <MagneticButton variant="primary" onClick={() => fetchPortalData()} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
                Check again
              </MagneticButton>
            </Surface>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredTenders.map((tender, rank) => {
                const tenderBids = bids.filter((b) => b.tender_id === tender.id);
                const potholeCount = tender.potholes?.length || tender.pothole_count || 0;
                const isSelected = selectedTender?.id === tender.id;
                const leadPhoto = tender.potholes?.find((p) => p.image_url) || null;
                const extraPhotos = (tender.potholes?.length || 0) - (leadPhoto ? 1 : 0);

                return (
                  <Reveal key={tender.id} delay={Math.min(rank, 5) * 50}>
                    <article
                      className={`flex h-full flex-col overflow-hidden rounded-xl border bg-surface shadow-1 transition-colors ${
                        isSelected ? "border-signal" : "border-hairline"
                      }`}
                    >
                      {leadPhoto?.image_url ? (
                        <button
                          type="button"
                          onClick={() => leadPhoto.image_url && setPreviewImage(leadPhoto.image_url)}
                          className="relative block w-full overflow-hidden border-b border-hairline"
                          aria-label="Open full damage evidence photo"
                        >
                          <img
                            src={leadPhoto.image_url}
                            alt="Pothole damage evidence"
                            className="aspect-video w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                          {extraPhotos > 0 && (
                            <span className="absolute bottom-2 right-2 rounded-full border border-hairline bg-surface/95 px-2 py-0.5 font-mono text-[10px] font-semibold text-ink">
                              +{extraPhotos} more
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 border-b border-hairline bg-sunken text-ink3">
                          <ImageIcon className="h-5 w-5" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
                            S3 evidence pending sync
                          </span>
                        </div>
                      )}

                      <div className="flex flex-1 flex-col gap-4 p-5">
                        <div className="flex items-start gap-3">
                          <span className="font-mono text-lg font-semibold leading-none text-signal">
                            {String(rank + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="line-clamp-2 font-display text-sm font-bold leading-snug text-ink">
                              {tender.title}
                            </h3>
                            <p className="mt-1 truncate font-mono text-xs text-ink3">
                              {tender.district || "AP Region"} • {tender.mandal || "Central"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Pill tone={TENDER_TONE[tender.status] ?? "neutral"} pulse={tender.status === "open"}>
                            {STATUS_LABEL[tender.status] ?? tender.status.replace("_", " ")}
                          </Pill>
                        </div>

                        <div className="grid grid-cols-2 gap-3 rounded-lg border border-hairline bg-sunken p-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">
                              Potholes
                            </p>
                            <p className="mt-1 font-mono text-sm text-ink">{potholeCount} sites</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">
                              Budget
                            </p>
                            <p className="mt-1 font-mono text-sm text-ok">
                              ₹{Number(tender.estimated_cost).toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>

                        <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-4">
                          <span className="font-mono text-xs text-ink3">{tenderBids.length} bid(s)</span>
                          <MagneticButton variant="primary" onClick={() => inspectTender(tender)}>
                            Inspect &amp; bid
                            <ArrowRight className="h-4 w-4" />
                          </MagneticButton>
                        </div>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink3 sm:px-6">
          <span>
            Andhra Pradesh Road Works &amp; pothole repair tendering system — powered by Pothole
            Reporter.
          </span>
          <span className="font-mono">live feed refreshed every 30s · bulk re-sync every 15–30 days</span>
        </div>
      </footer>

      {/* Dossier */}
      <AnimatePresence>
        {selectedTender && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Tender dossier"
            onClick={() => setSelectedTender(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
              className={`my-4 w-full max-w-4xl ${stampFx ? "animate-mac-pop" : ""}`}
            >
              <Surface
                level={3}
                padded={false}
                className="overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
            <div className="flex items-start justify-between gap-4 border-b border-hairline bg-sunken p-5">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedRank > 0 && (
                    <span className="font-mono text-sm font-semibold text-signal">
                      {String(selectedRank).padStart(2, "0")}
                    </span>
                  )}
                  <span className="font-mono text-xs text-ink3">
                    {selectedTender.district} • {selectedTender.mandal}
                  </span>
                  <Pill tone={TENDER_TONE[selectedTender.status] ?? "neutral"}>
                    {STATUS_LABEL[selectedTender.status] ?? selectedTender.status.replace("_", " ")}
                  </Pill>
                </div>
                <h2 className="line-clamp-2 font-display text-lg font-bold leading-snug text-ink">
                  {selectedTender.title}
                </h2>
                <p className="flex items-center gap-1.5 font-mono text-xs text-ink3">
                  <Hash className="h-3.5 w-3.5" />
                  {selectedTender.block_id}
                </p>
              </div>
              <MagneticButton
                variant="ghost"
                onClick={() => setSelectedTender(null)}
                aria-label="Close tender dossier"
                className="shrink-0 !px-2.5"
              >
                <X className="h-4 w-4" />
              </MagneticButton>
            </div>

            <div className="flex border-b border-hairline bg-surface px-2">
              {(
                [
                  ["details", "Details"],
                  ["bid", "Submit bid"],
                  ["bids", `Received bids (${selectedBids.length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setModalTab(key)}
                  aria-pressed={modalTab === key}
                  className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                    modalTab === key
                      ? "border-signal text-ink"
                      : "border-transparent text-ink2 hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              {modalTab === "details" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-hairline bg-sunken p-4 md:grid-cols-4">
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">
                        Pothole count
                      </span>
                      <strong className="font-mono text-sm text-ink">
                        {selectedTender.potholes?.length || selectedTender.pothole_count} sites
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">
                        Estimated cost
                      </span>
                      <strong className="font-mono text-sm text-ok">
                        ₹{Number(selectedTender.estimated_cost).toLocaleString("en-IN")}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">
                        Deadline
                      </span>
                      <strong className="flex items-center gap-1.5 font-mono text-sm text-signal">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {selectedTender.deadline
                          ? new Date(selectedTender.deadline).toLocaleDateString()
                          : "20 days"}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">
                        Jurisdiction
                      </span>
                      <strong className="text-sm text-ink">
                        {selectedTender.mandal}, {selectedTender.district}
                      </strong>
                    </div>
                  </div>

                  {selectedTender.potholes && selectedTender.potholes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink2">
                        Geotagged coordinates (OpenStreetMap)
                      </h4>
                      <div className="overflow-hidden rounded-lg border border-hairline">
                        <TenderMap potholes={selectedTender.potholes} height="260px" zoom={13} />
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink2">
                      Visual evidence &amp; defect dossier
                    </h4>
                    {!selectedTender.potholes || selectedTender.potholes.length === 0 ? (
                      <p className="text-sm text-ink3">No individual pothole coordinates loaded.</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {selectedTender.potholes.map((p, idx) => (
                          <div
                            key={p.id || idx}
                            className="flex items-start gap-3 rounded-lg border border-hairline bg-sunken p-3"
                          >
                            {p.image_url ? (
                              <button
                                type="button"
                                onClick={() => p.image_url && setPreviewImage(p.image_url)}
                                className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-hairline bg-surface"
                                aria-label="Open pothole evidence photo"
                              >
                                <img
                                  src={p.image_url}
                                  alt="Pothole proof"
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ) : (
                              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-hairline bg-surface p-1 text-center">
                                <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-ink3">
                                  S3 pending
                                </span>
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-semibold text-signal">
                                  Site #{idx + 1}
                                </span>
                                <Pill tone="ok" className="!py-0.5 !text-[10px]">
                                  {p.status}
                                </Pill>
                              </div>
                              {p.address_notes && (
                                <p className="line-clamp-2 text-sm leading-tight text-ink2">
                                  {p.address_notes}
                                </p>
                              )}
                              <p className="font-mono text-[11px] text-ink3">
                                GPS: {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                              </p>
                              {p.reporter_name && (
                                <p className="text-[11px] text-ink3">Reported by: {p.reporter_name}</p>
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
                <form onSubmit={handleBidSubmit} className="mx-auto max-w-3xl space-y-5">
                  <div>
                    <h3 className="font-display text-base font-bold text-ink">
                      Submit contractor proposal
                    </h3>
                    <p className="mt-1 text-sm text-ink2">
                      Official quotation for {selectedTender.title} (est. ₹
                      {Number(selectedTender.estimated_cost).toLocaleString("en-IN")}).
                    </p>
                  </div>

                  {bidSuccessMsg && (
                    <div className="flex items-start gap-2 rounded-lg border border-ok/40 bg-ok/10 px-4 py-3">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                      <span className="text-sm text-ink">{bidSuccessMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Contractor full name" htmlFor="bid-contractor" required>
                      <Input
                        id="bid-contractor"
                        type="text"
                        required
                        value={bidForm.contractor_name}
                        onChange={(e) => setBidForm({ ...bidForm, contractor_name: e.target.value })}
                        placeholder="e.g. Ramesh Naidu"
                      />
                    </Field>
                    <Field label="Company / enterprise" htmlFor="bid-company" required>
                      <Input
                        id="bid-company"
                        type="text"
                        required
                        value={bidForm.company_name}
                        onChange={(e) => setBidForm({ ...bidForm, company_name: e.target.value })}
                        placeholder="e.g. Apex Infrastructure Pvt Ltd"
                      />
                    </Field>
                    <Field label="License / R&B reg ID" htmlFor="bid-license">
                      <Input
                        id="bid-license"
                        type="text"
                        value={bidForm.license_number}
                        onChange={(e) => setBidForm({ ...bidForm, license_number: e.target.value })}
                        placeholder="e.g. AP-R&B-CL1-2024"
                      />
                    </Field>
                    <Field label="Email" htmlFor="bid-email" required>
                      <Input
                        id="bid-email"
                        type="email"
                        required
                        value={bidForm.email}
                        onChange={(e) => setBidForm({ ...bidForm, email: e.target.value })}
                        placeholder="bids@company.com"
                      />
                    </Field>
                    <Field label="Contact phone" htmlFor="bid-phone" required>
                      <Input
                        id="bid-phone"
                        type="tel"
                        required
                        value={bidForm.phone}
                        onChange={(e) => setBidForm({ ...bidForm, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                      />
                    </Field>
                    <Field label="Quotation amount (INR)" htmlFor="bid-amount" required>
                      <Input
                        id="bid-amount"
                        type="number"
                        required
                        value={bidForm.bid_amount}
                        onChange={(e) => setBidForm({ ...bidForm, bid_amount: e.target.value })}
                        placeholder={`e.g. ${selectedTender.estimated_cost}`}
                        className="font-mono tnum"
                      />
                    </Field>
                    <Field label="Execution timeline (days)" htmlFor="bid-days" required>
                      <Input
                        id="bid-days"
                        type="number"
                        required
                        value={bidForm.estimated_days}
                        onChange={(e) => setBidForm({ ...bidForm, estimated_days: e.target.value })}
                        placeholder="15"
                      />
                    </Field>
                    <Field
                      label="Methodology & proposal notes"
                      htmlFor="bid-notes"
                      className="sm:col-span-2"
                    >
                      <Textarea
                        id="bid-notes"
                        rows={3}
                        value={bidForm.proposal_notes}
                        onChange={(e) => setBidForm({ ...bidForm, proposal_notes: e.target.value })}
                        placeholder="Outline asphalt specifications, compaction machinery, warranty duration…"
                      />
                    </Field>
                  </div>

                  <MagneticButton type="submit" variant="primary" block disabled={bidSubmitting}>
                    {bidSubmitting ? "Submitting proposal…" : "Confirm & submit bid to R&B portal"}
                  </MagneticButton>
                </form>
              )}

              {modalTab === "bids" && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink2">
                    Bids placed for this tender
                  </h4>
                  {selectedBids.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-hairline p-8 text-center">
                      <p className="text-sm text-ink3">No contractor bids submitted yet.</p>
                      <MagneticButton variant="secondary" onClick={() => setModalTab("bid")}>
                        <Plus className="h-4 w-4" />
                        Be the first to submit a bid
                      </MagneticButton>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedBids.map((b) => (
                        <div
                          key={b.id}
                          className="flex flex-col gap-3 rounded-lg border border-hairline bg-sunken p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="font-display text-sm font-bold text-ink">{b.company_name}</p>
                            <p className="text-xs text-ink2">
                              Contractor: <span className="text-ink">{b.contractor_name}</span> • License:{" "}
                              <span className="font-mono tnum">{b.license_number}</span>
                            </p>
                            {b.proposal_notes && (
                              <p className="text-sm italic text-ink3">&ldquo;{b.proposal_notes}&rdquo;</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-sm font-semibold text-ok">
                              ₹{Number(b.bid_amount).toLocaleString("en-IN")}
                            </p>
                            <p className="font-mono text-[11px] text-ink3">
                              {b.estimated_days} days timeline
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
              </Surface>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-3"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Full evidence photo preview"
        >
          <div className="relative max-h-[88vh] max-w-5xl overflow-hidden rounded-xl border border-hairline bg-surface p-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage(null);
              }}
              aria-label="Close photo preview"
              className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-surface/95 text-ink transition-colors hover:bg-sunken"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewImage}
              alt="Full evidence preview"
              className="max-h-[84vh] w-full rounded-lg object-contain"
            />
          </div>
        </div>
      )}

      {/* API specs modal */}
      <AnimatePresence>
        {showApiModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Tender portal API and sync specifications"
            onClick={() => setShowApiModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
              className="my-4 w-full max-w-2xl"
            >
              <Surface
                level={3}
                padded={false}
                className="overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
            <div className="flex items-center justify-between gap-3 border-b border-hairline bg-sunken px-5 py-3">
              <h3 className="font-display text-base font-bold text-ink">
                API &amp; sync specifications
              </h3>
              <MagneticButton
                variant="ghost"
                onClick={() => setShowApiModal(false)}
                aria-label="Close API specifications"
                className="!px-2.5"
              >
                <X className="h-4 w-4" />
              </MagneticButton>
            </div>
            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5 text-sm text-ink2">
              <p className="leading-relaxed">
                This tendering website exposes an authenticated ingestion API that accepts verified
                pothole reports, high-res photos, and auto-bundled tenders transmitted by the main
                Pothole Reporter system every 15 to 30 days.
              </p>

              <div className="space-y-1.5 rounded-lg border border-hairline bg-sunken p-4 font-mono text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-signal">
                  API endpoint specification
                </p>
                <p>
                  <span className="font-bold text-ok">POST</span> /api/sync{" "}
                  <span className="text-ink3">(ingest potholes &amp; tenders)</span>
                </p>
                <p>
                  <span className="font-bold text-ok">DELETE</span> /api/tenders{" "}
                  <span className="text-ink3">(withdraw a tender: {"{ tender_id }"})</span>
                </p>
                <p className="text-ink3">
                  Header: <strong className="text-ink">X-API-Key: &lt;configured TENDER_API_KEY&gt;</strong>
                </p>
                <p className="text-ink3">
                  Header: <strong className="text-ink">Content-Type: application/json</strong>
                </p>
              </div>

              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink2">
                  Sample sync payload
                </h4>
                <pre className="overflow-x-auto rounded-lg border border-hairline bg-sunken p-4 font-mono text-[11px] text-ink3 tnum">
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
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink2">
                  Recent inbound synchronisations
                </h4>
                {syncLogs.length === 0 ? (
                  <p className="text-sm text-ink3">No sync logs recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {syncLogs.slice(0, 4).map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-sunken p-3 text-xs"
                      >
                        <span className="font-mono tnum text-ink3">
                          {new Date(l.received_at).toLocaleString()}
                        </span>
                        <span className="font-mono tnum font-semibold text-ink">
                          {l.potholes_count} potholes • {l.tenders_count} tenders
                        </span>
                        <Pill tone={l.status === "success" ? "ok" : "bad"} className="!py-0.5 !text-[10px]">
                          {l.status}
                        </Pill>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
              </Surface>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </main>
    </MotionConfig>
  );
}
