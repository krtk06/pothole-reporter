"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { ExternalLink } from "lucide-react";
import PixelIcon from "@/components/pixel/PixelIcon";
import {
  PixelWindow,
  PixelButton,
  PixelChip,
} from "@/components/pixel/PixelUI";
import DotPager from "@/components/pixel/DotPager";
import PixelSprite from "@/components/pixel/PixelSprite";
import BrandLogo from "@/components/pixel/BrandLogo";
import { sanitizeTenders } from "@/lib/liveSource";
import type { TenderItem, Pothole, ContractorBid, SyncLogEntry } from "@/lib/tenderStore";

// Dynamically load Leaflet map to avoid SSR issues
const TenderMap = dynamic(() => import("@/components/TenderMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-well">
      <span className="ledger text-dim">LOADING INTERACTIVE MAP…</span>
    </div>
  ),
});

const sealFor = (status: string) =>
  status === "open"
    ? "seal-open"
    : status === "under_review"
    ? "seal-review"
    : status === "assigned"
    ? "seal-assigned"
    : "seal-done";

const lampFor = (status: string) =>
  status === "open"
    ? "lamp-open"
    : status === "under_review"
    ? "lamp-review"
    : status === "assigned"
    ? "lamp-assigned"
    : "lamp-done";

const PAGES = [
  { id: "board", label: "Tender Board" },
  { id: "map", label: "State Map" },
  { id: "dossier", label: "Tender Dossier" },
];

const fieldInput =
  "mt-1 w-full border-2 border-line bg-void p-1.5 font-body text-sm text-body placeholder:text-dim outline-none focus:border-gold";

export default function TenderPortalHome() {
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

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [activeView, setActiveView] = useState<"grid" | "map">("grid");
  const [pageIndex, setPageIndex] = useState(0);

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
      // Bids endpoint stays as the authoritative bid list (portal-local)
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
    // Real-time refresh: re-pull the live backend feed every 30s and
    // whenever the tab becomes visible again.
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

  // Escape closes the topmost overlay: photo preview, then API specs, then dossier
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

  const selectedRank = selectedTender
    ? filteredTenders.findIndex((t) => t.id === selectedTender.id) + 1
    : 0;

  const selectedBids = selectedTender
    ? bids.filter((b) => b.tender_id === selectedTender.id)
    : [];

  const handlePageChange = (i: number) => {
    setPageIndex(i);
    setActiveView(i === 1 ? "map" : "grid");
  };

  const inspectTender = (tender: TenderItem) => {
    setSelectedTender(tender);
    setModalTab("details");
    handlePageChange(2);
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

  const boardPanel = (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="px-window flex items-center gap-2 p-2">
          <span className="lamp lamp-open" aria-hidden />
          <div className="min-w-0">
            <p className="font-pixel text-base leading-none text-body tnum">{openTendersCount}</p>
            <p className="ledger mt-1 text-dim">Open Tenders</p>
          </div>
        </div>
        <div className="px-well flex items-center gap-2 p-2">
          <PixelIcon name="pin" size={18} className="shrink-0 text-red" />
          <div className="min-w-0">
            <p className="font-pixel text-base leading-none text-body tnum">{totalPotholes}</p>
            <p className="ledger mt-1 text-dim">Total Potholes</p>
          </div>
        </div>
        <div className="px-window flex items-center gap-2 p-2">
          <PixelIcon name="coin" size={18} className="shrink-0 text-gold" />
          <div className="min-w-0">
            <p className="font-pixel text-[10px] leading-none text-body tnum truncate">
              ₹{totalBudget.toLocaleString("en-IN")}
            </p>
            <p className="ledger mt-1 text-dim">Estimated Budget</p>
          </div>
        </div>
        <div className="px-well flex items-center gap-2 p-2">
          <PixelIcon name="user" size={18} className="shrink-0 text-green" />
          <div className="min-w-0">
            <p className="font-pixel text-base leading-none text-body tnum">{bids.length}</p>
            <p className="ledger mt-1 text-dim">Contractor Bids</p>
          </div>
        </div>
      </div>

      <div className="px-window flex shrink-0 flex-col gap-2 p-2 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <PixelIcon
            name="search"
            size={12}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-dim"
          />
          <input
            type="text"
            aria-label="Search tender, block, mandal"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tender, block, mandal..."
            className="w-full border-2 border-line bg-well py-1.5 pl-7 pr-2 font-body text-sm text-body placeholder:text-dim outline-none focus:border-gold"
          />
        </div>
        <select
          aria-label="Filter by district"
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
          className="border-2 border-line bg-well px-2 py-1.5 font-body text-sm text-body outline-none focus:border-gold"
        >
          <option value="all">All Districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border-2 border-line bg-well px-2 py-1.5 font-body text-sm text-body outline-none focus:border-gold"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open for Bidding</option>
          <option value="under_review">Under Review</option>
          <option value="assigned">Assigned</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="px-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="px-window flex h-full min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center">
            <PixelSprite name="worker" size={64} className="px-anim-bob text-gold" />
            <p className="font-pixel text-[10px] text-body">FETCHING LIVE TENDERS…</p>
            <p className="ledger text-dim">
              PULLING THE LATEST PACKAGES FROM THE BACKEND (POSTGRES + AWS S3)
            </p>
          </div>
        ) : filteredTenders.length === 0 ? (
          <div className="px-window flex h-full min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center">
            <PixelSprite name="worker" size={64} className="text-gold" />
            <p className="font-pixel text-[10px] text-body">
              {tenders.length === 0 ? "NO TENDERS AVAILABLE" : "NO TENDERS MATCH YOUR CRITERIA"}
            </p>
            <p className="ledger max-w-md text-dim">
              {tenders.length === 0
                ? "THERE ARE CURRENTLY NO ROAD-WORK TENDERS PUBLISHED. NEW PACKAGES APPEAR HERE AUTOMATICALLY VIA SECURE SYNC."
                : "ADJUST FILTERS OR TRIGGER A SYNC FROM THE POTHOLE REPORTER ADMIN DASHBOARD."}
            </p>
            <PixelButton icon="clock" onClick={() => fetchPortalData()} disabled={loading}>
              Check Again
            </PixelButton>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTenders.map((tender, rank) => {
              const tenderBids = bids.filter((b) => b.tender_id === tender.id);
              const potholeCount = tender.potholes?.length || tender.pothole_count || 0;
              const isSelected = selectedTender?.id === tender.id;
              const leadPhoto = tender.potholes?.find((p) => p.image_url) || null;
              const extraPhotos = (tender.potholes?.length || 0) - (leadPhoto ? 1 : 0);

              return (
                <article
                  key={tender.id}
                  className={`px-window flex flex-col ${isSelected ? "ants" : ""}`}
                >
                  {leadPhoto?.image_url ? (
                    <button
                      type="button"
                      onClick={() => leadPhoto.image_url && setPreviewImage(leadPhoto.image_url)}
                      className="relative block w-full overflow-hidden border-b-2 border-[var(--px-edge-dk)]"
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
                        <span className="ledger absolute bottom-1 right-1 border-2 border-line bg-well px-1.5 py-0.5 text-gold">
                          +{extraPhotos} MORE
                        </span>
                      )}
                    </button>
                  ) : (
                    <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 border-b-2 border-[var(--px-edge-dk)] bg-well text-dim">
                      <PixelIcon name="image" size={20} />
                      <span className="ledger">S3 EVIDENCE PENDING SYNC</span>
                    </div>
                  )}

                  <div className="flex flex-1 flex-col gap-2 p-2.5">
                    <div className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="pt-0.5 font-pixel text-lg leading-none text-gold tnum"
                      >
                        {String(rank + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 font-pixel text-[10px] leading-snug text-body">
                          {tender.title}
                        </h3>
                        <p className="ledger mt-1 truncate text-gold">
                          {tender.district || "AP Region"} • {tender.mandal || "Central"}
                        </p>
                      </div>
                      <span className={`px-chip ${sealFor(tender.status)}`}>
                        <span className={`lamp ${lampFor(tender.status)}`} aria-hidden />
                        {tender.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="px-well grid grid-cols-2 gap-2 p-2">
                      <div>
                        <p className="ledger text-dim">Potholes</p>
                        <p className="mt-1 font-pixel text-[10px] text-body tnum">{potholeCount} SITES</p>
                      </div>
                      <div>
                        <p className="ledger text-dim">Budget</p>
                        <p className="mt-1 font-pixel text-[10px] text-green tnum">
                          ₹{Number(tender.estimated_cost).toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t-2 border-line pt-2">
                      <span className="ledger text-dim">{tenderBids.length} BID(S)</span>
                      <PixelButton icon="chevR" variant="gold" onClick={() => inspectTender(tender)}>
                        Inspect &amp; Bid
                      </PixelButton>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const mapPanel = (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="px-window flex shrink-0 items-center justify-between gap-3 p-2">
        <div className="flex min-w-0 items-center gap-2">
          <PixelIcon name="map" size={14} className="shrink-0 text-gold" />
          <h2 className="truncate font-pixel text-[10px] text-body">
            ANDHRA PRADESH POTHOLE DISTRIBUTION MAP
          </h2>
        </div>
        <PixelChip className="shrink-0">{allPotholes.length} GEOTAGGED</PixelChip>
      </div>
      <div className="px-window min-h-0 flex-1 overflow-hidden p-1">
        <TenderMap potholes={allPotholes} height="100%" zoom={8} />
      </div>
    </div>
  );

  const dossierPanel = (
    <div className="flex h-full flex-col p-3">
      {!selectedTender ? (
        <div className="px-window flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <PixelSprite name="worker" size={64} className="px-anim-bob text-gold" />
          <p className="font-pixel text-[10px] text-body">SELECT A TENDER FROM THE BOARD</p>
          <p className="ledger max-w-md text-dim">
            OPEN THE BOARD PANEL AND CHOOSE “INSPECT &amp; BID” TO LOAD THE DOSSIER.
          </p>
          <PixelButton icon="grid" onClick={() => handlePageChange(0)}>
            Go to Board
          </PixelButton>
        </div>
      ) : (
        <div
          className={`px-window flex h-full min-h-0 flex-col overflow-hidden ${
            stampFx ? "px-anim-stamp" : ""
          }`}
        >
          <div className="flex shrink-0 items-start justify-between gap-2 border-b-2 border-line bg-well p-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {selectedRank > 0 && (
                  <span className="font-pixel text-sm leading-none text-gold tnum">
                    {String(selectedRank).padStart(2, "0")}
                  </span>
                )}
                <span className="ledger text-gold">
                  {selectedTender.district} • {selectedTender.mandal}
                </span>
                <span className={`px-chip ${sealFor(selectedTender.status)}`}>
                  <span className={`lamp ${lampFor(selectedTender.status)}`} aria-hidden />
                  {selectedTender.status.replace("_", " ")}
                </span>
              </div>
              <h2 className="line-clamp-2 font-pixel text-[11px] leading-snug text-body">
                {selectedTender.title}
              </h2>
              <p className="ledger text-dim">BLOCK ID: {selectedTender.block_id}</p>
            </div>
            <PixelButton
              icon="close"
              onClick={() => setSelectedTender(null)}
              aria-label="Close tender dossier"
              className="shrink-0"
            />
          </div>

          <div className="flex shrink-0 border-b-2 border-line bg-panel">
            {(
              [
                ["details", "DETAILS"],
                ["bid", "SUBMIT BID"],
                ["bids", `RECEIVED BIDS (${selectedBids.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setModalTab(key)}
                className={`px-btn flex-1 ${modalTab === key ? "px-btn-gold" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="px-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            {modalTab === "details" && (
              <div className="space-y-4">
                <div className="px-well grid grid-cols-2 gap-3 p-3 md:grid-cols-4">
                  <div>
                    <span className="ledger block text-dim">Pothole Count</span>
                    <strong className="font-pixel text-[10px] text-body tnum">
                      {selectedTender.potholes?.length || selectedTender.pothole_count} SITES
                    </strong>
                  </div>
                  <div>
                    <span className="ledger block text-dim">Estimated Cost</span>
                    <strong className="font-pixel text-[10px] text-green tnum">
                      ₹{Number(selectedTender.estimated_cost).toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div>
                    <span className="ledger block text-dim">Submission Deadline</span>
                    <strong className="font-pixel text-[10px] text-gold">
                      {selectedTender.deadline
                        ? new Date(selectedTender.deadline).toLocaleDateString()
                        : "20 Days"}
                    </strong>
                  </div>
                  <div>
                    <span className="ledger block text-dim">Jurisdiction</span>
                    <strong className="font-pixel text-[10px] text-body">
                      {selectedTender.mandal}, {selectedTender.district}
                    </strong>
                  </div>
                </div>

                {selectedTender.potholes && selectedTender.potholes.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="ledger text-body">
                      GEOTAGGED POTHOLE COORDINATES (OPENSTREETMAP)
                    </h4>
                    <div className="px-window p-1">
                      <TenderMap potholes={selectedTender.potholes} height="240px" zoom={13} />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="ledger text-body">VISUAL EVIDENCE &amp; DEFECT DOSSIER</h4>
                  {!selectedTender.potholes || selectedTender.potholes.length === 0 ? (
                    <p className="ledger text-dim">NO INDIVIDUAL POTHOLE COORDINATES LOADED.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selectedTender.potholes.map((p, idx) => (
                        <div key={p.id || idx} className="px-well flex items-start gap-2 p-2">
                          {p.image_url ? (
                            <button
                              type="button"
                              onClick={() => p.image_url && setPreviewImage(p.image_url)}
                              className="h-20 w-20 shrink-0 overflow-hidden border-2 border-line bg-void"
                              aria-label="Open pothole evidence photo"
                            >
                              <img
                                src={p.image_url}
                                alt="Pothole proof"
                                className="h-full w-full object-cover"
                              />
                            </button>
                          ) : (
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center border-2 border-line bg-void p-1 text-center">
                              <span className="ledger text-dim">S3 PENDING</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-pixel text-[9px] text-gold">SITE #{idx + 1}</span>
                              <span className="ledger border border-line bg-void px-1 text-green">
                                {p.status}
                              </span>
                            </div>
                            {p.address_notes && (
                              <p className="line-clamp-2 text-sm leading-tight text-body">
                                {p.address_notes}
                              </p>
                            )}
                            <p className="ledger text-dim tnum">
                              GPS: {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                            </p>
                            {p.reporter_name && (
                              <p className="ledger text-dim">REPORTED BY: {p.reporter_name}</p>
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
              <form onSubmit={handleBidSubmit} className="mx-auto max-w-3xl space-y-3">
                <div className="space-y-1 text-center">
                  <h3 className="font-pixel text-[11px] text-body">SUBMIT CONTRACTOR PROPOSAL</h3>
                  <p className="ledger text-dim">
                    OFFICIAL QUOTATION FOR {selectedTender.title} (EST. ₹
                    {Number(selectedTender.estimated_cost).toLocaleString("en-IN")})
                  </p>
                </div>

                {bidSuccessMsg && (
                  <div className="flex items-center gap-2 border-2 border-greendk bg-well p-2 text-green">
                    <PixelIcon name="check" size={12} />
                    <span className="ledger">{bidSuccessMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="ledger text-dim" htmlFor="bid-contractor">
                      Contractor Full Name *
                    </label>
                    <input
                      id="bid-contractor"
                      type="text"
                      required
                      value={bidForm.contractor_name}
                      onChange={(e) => setBidForm({ ...bidForm, contractor_name: e.target.value })}
                      placeholder="e.g. Ramesh Naidu"
                      className={fieldInput}
                    />
                  </div>
                  <div>
                    <label className="ledger text-dim" htmlFor="bid-company">
                      Company / Enterprise Name *
                    </label>
                    <input
                      id="bid-company"
                      type="text"
                      required
                      value={bidForm.company_name}
                      onChange={(e) => setBidForm({ ...bidForm, company_name: e.target.value })}
                      placeholder="e.g. Apex Infrastructure Pvt Ltd"
                      className={fieldInput}
                    />
                  </div>
                  <div>
                    <label className="ledger text-dim" htmlFor="bid-license">
                      License / R&amp;B Reg ID
                    </label>
                    <input
                      id="bid-license"
                      type="text"
                      value={bidForm.license_number}
                      onChange={(e) => setBidForm({ ...bidForm, license_number: e.target.value })}
                      placeholder="e.g. AP-R&B-CL1-2024"
                      className={fieldInput}
                    />
                  </div>
                  <div>
                    <label className="ledger text-dim" htmlFor="bid-email">
                      Email *
                    </label>
                    <input
                      id="bid-email"
                      type="email"
                      required
                      value={bidForm.email}
                      onChange={(e) => setBidForm({ ...bidForm, email: e.target.value })}
                      placeholder="bids@company.com"
                      className={fieldInput}
                    />
                  </div>
                  <div>
                    <label className="ledger text-dim" htmlFor="bid-phone">
                      Contact Phone *
                    </label>
                    <input
                      id="bid-phone"
                      type="tel"
                      required
                      value={bidForm.phone}
                      onChange={(e) => setBidForm({ ...bidForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className={fieldInput}
                    />
                  </div>
                  <div>
                    <label className="ledger text-dim" htmlFor="bid-amount">
                      Quotation Amount (INR ₹) *
                    </label>
                    <input
                      id="bid-amount"
                      type="number"
                      required
                      value={bidForm.bid_amount}
                      onChange={(e) => setBidForm({ ...bidForm, bid_amount: e.target.value })}
                      placeholder={`e.g. ${selectedTender.estimated_cost}`}
                      className={`${fieldInput} font-pixel text-[10px] tnum`}
                    />
                  </div>
                  <div>
                    <label className="ledger text-dim" htmlFor="bid-days">
                      Execution Timeline (Days) *
                    </label>
                    <input
                      id="bid-days"
                      type="number"
                      required
                      value={bidForm.estimated_days}
                      onChange={(e) => setBidForm({ ...bidForm, estimated_days: e.target.value })}
                      placeholder="15"
                      className={fieldInput}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="ledger text-dim" htmlFor="bid-notes">
                      Methodology &amp; Proposal Notes
                    </label>
                    <textarea
                      id="bid-notes"
                      rows={3}
                      value={bidForm.proposal_notes}
                      onChange={(e) => setBidForm({ ...bidForm, proposal_notes: e.target.value })}
                      placeholder="Outline asphalt specifications, compaction machinery, warranty duration..."
                      className={fieldInput}
                    />
                  </div>
                </div>

                <PixelButton
                  type="submit"
                  variant="gold"
                  icon="send"
                  disabled={bidSubmitting}
                  className="w-full"
                >
                  {bidSubmitting ? "Submitting Proposal..." : "Confirm & Submit Bid to R&B Portal"}
                </PixelButton>
              </form>
            )}

            {modalTab === "bids" && (
              <div className="space-y-2">
                <h4 className="ledger text-body">BIDS PLACED FOR THIS TENDER</h4>
                {selectedBids.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 border-2 border-dashed border-line p-6 text-center">
                    <p className="ledger text-dim">NO CONTRACTOR BIDS SUBMITTED YET.</p>
                    <PixelButton icon="plus" onClick={() => setModalTab("bid")}>
                      Be the first to submit a bid
                    </PixelButton>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedBids.map((b) => (
                      <div
                        key={b.id}
                        className="px-well flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="font-pixel text-[10px] text-body">{b.company_name}</p>
                          <p className="ledger text-dim">
                            CONTRACTOR: <span className="text-body">{b.contractor_name}</span> • LICENSE:{" "}
                            <span className="tnum">{b.license_number}</span>
                          </p>
                          {b.proposal_notes && (
                            <p className="text-sm italic text-dim">&ldquo;{b.proposal_notes}&rdquo;</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-pixel text-[11px] text-green tnum">
                            ₹{Number(b.bid_amount).toLocaleString("en-IN")}
                          </p>
                          <p className="ledger text-dim tnum">{b.estimated_days} DAYS TIMELINE</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-void font-body text-body">
      {/* Static sync status strip */}
      <div
        className="ledger flex shrink-0 flex-wrap items-center gap-x-4 gap-y-0.5 border-b-2 border-line bg-well px-3 py-1 text-dim"
        aria-label="Synchronization status"
      >
        <span className="flex items-center gap-1.5 text-body">
          <PixelIcon name="grid" size={10} />
          GOVT OF AP • R&amp;B
        </span>
        <span className="hidden md:inline">PUBLIC WORKS E-PROCUREMENT</span>
        <span className={live?.backend_reachable ? "text-green" : "text-orange"}>
          {live == null
            ? "CONNECTING…"
            : live.backend_reachable
            ? "● LIVE — BACKEND (POSTGRES + AWS S3)"
            : "○ OFFLINE — SHOWING LAST SYNCED CACHE"}
        </span>
        <span className="hidden lg:inline">LAST SYNC: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "NEVER"}</span>
        <span className="hidden xl:inline">EVERY 15–30 DAYS</span>
        <span className="hidden sm:inline text-gold">POST /API/SYNC</span>
      </div>

      {/* Masthead */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-line bg-panel px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <BrandLogo
            src="/brand/tendering.png"
            alt="AP Road Works Tendering"
            size={42}
            fallback={
              <span className="px-bevel flex h-9 w-9 shrink-0 items-center justify-center bg-gold text-[var(--px-on-accent)]">
                <PixelIcon name="grid" size={16} />
              </span>
            }
          />
          <div className="min-w-0">
            <h1 className="truncate font-pixel text-[10px] leading-tight text-body md:text-xs">
              AP ROAD WORKS TENDERING PORTAL
            </h1>
            <p className="ledger truncate text-dim">
              CROWDSOURCED POTHOLE REMEDIATION PACKAGES &amp; BID INGESTION
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <PixelButton
            onClick={() => fetchPortalData()}
            disabled={loading}
            icon="clock"
            className="hidden sm:inline-flex"
          >
            Refresh
          </PixelButton>
          <PixelButton onClick={() => setShowApiModal(true)}>
            <span className="lamp lamp-open" aria-hidden />
            <span className="hidden sm:inline">API KEY: ACTIVE</span>
            <PixelIcon name="help" size={12} />
          </PixelButton>
          <a
            href="http://localhost:3000/admin"
            target="_blank"
            rel="noreferrer"
            className="px-btn inline-flex items-center justify-center gap-2"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            <span className="hidden sm:inline">Pothole Admin</span>
          </a>
        </div>
      </header>

      {/* Fixed-viewport paged shell */}
      <DotPager
        pages={PAGES}
        active={pageIndex}
        onChange={handlePageChange}
        ariaLabel="Tender portal sections"
        className="min-h-0 flex-1"
      >
        {boardPanel}
        {mapPanel}
        {dossierPanel}
      </DotPager>

      {/* Thin static footer */}
      <footer className="shrink-0 border-t-2 border-line bg-panel px-3 py-1">
        <p className="ledger truncate text-center text-dim">
          ANDHRA PRADESH ROAD WORKS &amp; POTHOLE REPAIR TENDERING SYSTEM • POWERED BY POTHOLE
          REPORTER • LIVE FEED (POSTGRES + AWS S3) REFRESHED EVERY 30S • BULK RE-SYNC EVERY 15–30
          DAYS
        </p>
      </footer>

      {/* FULL PHOTO PREVIEW MODAL */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Full evidence photo preview"
        >
          <div className="px-window relative max-h-[85vh] max-w-4xl overflow-hidden bg-well p-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage(null);
              }}
              aria-label="Close photo preview"
              className="px-btn absolute right-1 top-1 z-10 inline-flex items-center justify-center"
            >
              <PixelIcon name="close" size={10} />
            </button>
            <img
              src={previewImage}
              alt="Full evidence preview"
              className="max-h-[80vh] w-full object-contain"
            />
          </div>
        </div>
      )}

      {/* API KEY & INTEGRATION DOCUMENTATION MODAL */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
          <PixelWindow
            title="TENDER PORTAL API & SYNC SPECIFICATIONS"
            icon="help"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col"
            bodyClassName="px-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-3 text-sm text-body"
            actions={
              <button
                type="button"
                onClick={() => setShowApiModal(false)}
                aria-label="Close API specifications"
                className="px-btn inline-flex items-center justify-center"
              >
                <PixelIcon name="close" size={10} />
              </button>
            }
          >
            <p className="leading-snug text-dim">
              This tendering website exposes an authenticated ingestion API that accepts verified
              pothole reports, high-res photos, and auto-bundled tenders transmitted by the main
              Pothole Reporter system every 15 to 30 days.
            </p>

            <div className="px-well space-y-1 p-3 font-mono text-sm">
              <p className="ledger text-gold">API ENDPOINT SPECIFICATION:</p>
              <p>
                <span className="font-bold text-green">POST</span> /api/sync{" "}
                <span className="text-dim">(ingest potholes &amp; tenders)</span>
              </p>
              <p>
                <span className="font-bold text-green">DELETE</span> /api/tenders{" "}
                <span className="text-dim">(withdraw a tender: {"{ tender_id }"})</span>
              </p>
              <p className="text-dim">
                Header: <strong className="text-body">X-API-Key: &lt;configured TENDER_API_KEY&gt;</strong>
              </p>
              <p className="text-dim">
                Header: <strong className="text-body">Content-Type: application/json</strong>
              </p>
            </div>

            <div>
              <h4 className="ledger mb-1.5 text-body">Sample Sync Payload Format:</h4>
              <pre className="px-well overflow-x-auto p-3 font-mono text-[11px] text-dim tnum">
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
              <h4 className="ledger text-body">Recent Inbound Synchronizations:</h4>
              {syncLogs.length === 0 ? (
                <p className="ledger text-dim">NO SYNC LOGS RECORDED YET.</p>
              ) : (
                <div className="space-y-1.5">
                  {syncLogs.slice(0, 4).map((l) => (
                    <div
                      key={l.id}
                      className="px-well flex items-center justify-between gap-2 p-2 text-[11px]"
                    >
                      <span className="tnum text-dim">{new Date(l.received_at).toLocaleString()}</span>
                      <span className="tnum font-semibold text-body">
                        {l.potholes_count} POTHOLE • {l.tenders_count} TENDERS
                      </span>
                      <span className="font-mono font-semibold text-green">{l.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PixelWindow>
        </div>
      )}
    </div>
  );
}
