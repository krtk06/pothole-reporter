"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, Image as ImageIcon, Loader2, RefreshCw, Navigation, CheckCircle2, Upload as UploadIcon, Camera, FolderOpen, Map } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Report, PublicPothole } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getDistrictBounds } from "@/data/india-locations";
import dynamic from "next/dynamic";

const PublicMiniMap = dynamic(() => import("@/components/PublicMiniMap"), { ssr: false });

const statusMeta: Record<string, { label: string; color: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", color: "secondary" },
  verified: { label: "Verified", color: "default" },
  rejected: { label: "Rejected", color: "destructive" },
  fixed: { label: "Fixed", color: "outline" },
};

export default function Dashboard() {
  const { user, logout, selectedState, selectedDistrict, selectedMandal } = useStore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [publicPotholes, setPublicPotholes] = useState<PublicPothole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMap, setLoadingMap] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState("");
  const [descLoc, setDescLoc] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState("");
  const [locating, setLocating] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showMap, setShowMap] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchReports();
  }, [user]);

  // Fetch public potholes for the mini map (scoped to user's district if available)
  useEffect(() => {
    if (!user) return;
    const state = selectedState || user.state;
    const district = selectedDistrict || user.district;
    const mandal = selectedMandal || user.mandal;

    api.getPublicPotholes(state || undefined, district || undefined, mandal || undefined)
      .then((data) => setPublicPotholes(data.potholes || []))
      .catch(() => {})
      .finally(() => setLoadingMap(false));
  }, [user, selectedState, selectedDistrict, selectedMandal]);

  const districtBounds = (selectedState || user?.state) && (selectedDistrict || user?.district)
    ? getDistrictBounds(
        selectedState || user?.state || "",
        selectedDistrict || user?.district || ""
      )
    : null;

  // Convert user's own reports to PublicPothole format for map overlay
  const userMapPotholes: PublicPothole[] = reports.map((r) => ({
    id: r.id,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    status: r.status,
    block_id: r.block_id,
    created_at: r.created_at,
  }));

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocError("Your browser doesn't support GPS.");
      return;
    }
    navigator.permissions?.query({ name: "geolocation" }).then((perm) => {
      if (perm.state === "denied") {
        setLocError("GPS blocked in browser settings.");
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
        () => { setLocating(false); setLocError("Could not get GPS."); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }).catch(() => {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
        () => { setLocating(false); setLocError("Could not get GPS."); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  };

  const fetchReports = async () => {
    try {
      const data = await api.getMyReports();
      setReports((data.reports || []).sort((a: Report, b: Report) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("Invalid or expired") || msg.includes("Missing or invalid")) setSessionExpired(true);
    } finally { setLoading(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFiles([file]); setError(""); }
  };

  const handleUpload = async () => {
    const file = selectedFiles[0];
    if (!file) { setError("Select a photo first"); return; }
    if (!location) { setError("Use your location before submitting"); return; }
    setUploading(true); setError(""); setSuccess("");

    try {
      let key: string;
      try {
        const presigned = await api.getPresignedUrl(file.name, file.type);
        const uploadRes = await fetch(presigned.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!uploadRes.ok) throw new Error("");
        key = presigned.key;
      } catch (uploadError) {
        if (process.env.NODE_ENV === "production") {
          throw new Error("Photo upload is temporarily unavailable. Please try again shortly.");
        }
        console.warn("S3 upload failed; using the local development upload fallback.", uploadError);
        const local = await api.uploadLocal(file);
        key = local.key;
      }

      // Build block_id from selected location
      const state = selectedState || user?.state || "";
      const district = selectedDistrict || user?.district || "";
      const mandal = selectedMandal || user?.mandal || "";
      const blockId = state && district && mandal
        ? `${state.toLowerCase()}/${district.toLowerCase()}/${mandal.toLowerCase()}`
        : state && district
        ? `${state.toLowerCase()}/${district.toLowerCase()}`
        : undefined;

      const combinedNotes = [notes, descLoc ? `📍 ${descLoc}` : ""].filter(Boolean).join("\n");
      await api.submitReport(key, location.lat, location.lng, combinedNotes || undefined, blockId);
      setSuccess("Pothole reported!");
      setNotes(""); setDescLoc(""); setSelectedFiles([]);
      fetchReports();
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("Invalid or expired") || msg.includes("Missing or invalid")) {
        setError("Session expired. Please log in again.");
      } else {
        setError(msg || "Upload failed");
      }
    } finally { setUploading(false); }
  };

  if (!mounted || !user) return null;

  const locationLabel = [selectedMandal || user.mandal, selectedDistrict || user.district, selectedState || user.state]
    .filter(Boolean).join(", ");

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
        <div className="flex items-center gap-4">
          {locationLabel && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-full px-3 py-1">
              <MapPin className="w-3 h-3" />
              {locationLabel}
            </div>
          )}
          <span className="text-sm text-[var(--color-text-secondary)] hidden sm:block">{user.name}</span>
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => { void logout().finally(() => router.push("/")); }} className="text-[var(--color-text-secondary)]">
            Logout
          </Button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Hero */}
        <div
          className="text-center mb-10 bg-no-repeat bg-cover bg-center rounded-2xl py-16 px-4 relative overflow-hidden"
          style={{ backgroundImage: "url('https://raw.githubusercontent.com/prebuiltui/prebuiltui/main/assets/hero/gridBackground.png')" }}
        >
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 border border-[var(--color-border)] rounded-full px-4 py-1.5 text-xs text-[var(--color-text-secondary)] mb-6 backdrop-blur-sm">
              <span>New — Report a pothole in seconds</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-[var(--color-heading)] max-w-3xl mx-auto">
              Report a <span className="text-[var(--color-text-primary)]">Pothole</span>
            </h1>
            <p className="text-[var(--color-text-secondary)] mt-4 max-w-xl mx-auto">
              Snap a photo, tag the spot, and help fix your streets.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button variant="outline" className="border-[var(--color-border)] text-[var(--color-text-secondary)] px-6 py-3 rounded-full font-medium backdrop-blur-sm" onClick={getLocation} disabled={locating}>
                <Navigation className="w-4 h-4" /> {locating ? "Locating..." : "Use My Location"}
              </Button>
            </div>
          </div>
        </div>

        {/* Upload section */}
        <div className="max-w-lg mx-auto mb-10">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          <input type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" id="camera-input" />

          {!selectedFiles.length ? (
            <div className="grid grid-cols-2 gap-4">
              <Button onClick={() => document.getElementById("camera-input")?.click()} className="h-32 flex-col gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all" variant="ghost">
                <Camera className="w-8 h-8" /><span className="text-sm font-medium">Camera</span>
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} className="h-32 flex-col gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all" variant="ghost">
                <FolderOpen className="w-8 h-8" /><span className="text-sm font-medium">Browse</span>
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-[var(--color-text-secondary)] text-center">Selected: {selectedFiles[0].name}</p>
              <Textarea value={descLoc} onChange={(e) => setDescLoc(e.target.value)} placeholder="Where is this pothole? (e.g. 'In front of 42 Maple Street')" className="bg-[var(--color-surface)] border-[var(--color-border)] text-sm" rows={2} />
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Extra details (size, depth, etc.)" className="bg-[var(--color-surface)] border-[var(--color-border)] text-sm" rows={2} />
              {location && <p className="text-xs text-green-500 text-center font-mono">📍 {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>}
              {locError && <p className="text-xs text-red-400 text-center">{locError}</p>}
              <div className="flex justify-center gap-3">
                <Button onClick={handleUpload} disabled={uploading} className="rounded-full">
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><UploadIcon className="w-4 h-4" /> Submit Report</>}
                </Button>
                <Button variant="ghost" onClick={() => setSelectedFiles([])} className="text-[var(--color-text-secondary)]">Cancel</Button>
              </div>
              <AnimatePresence>
                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400 text-center">{error}</motion.p>}
                {success && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-green-500 text-center">{success}</motion.p>}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Session expired */}
        <AnimatePresence>
          {sessionExpired && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 mb-6 rounded-xl border border-red-500/30 bg-red-500/5 text-center max-w-lg mx-auto">
              <p className="font-semibold text-red-400 mb-1">Session expired</p>
              <p className="text-xs text-[var(--color-text-secondary)] mb-3">Your login token is no longer valid.</p>
              <Button size="sm" onClick={() => { void logout().finally(() => router.push("/")); }}>Go to Login</Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mini Map Section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-[var(--color-heading)]">
                <Map className="w-5 h-5 inline-block mr-2 text-[var(--color-text-secondary)]" />
                Potholes Near You
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {locationLabel
                  ? `Showing potholes in ${locationLabel}`
                  : "Showing all potholes (set your location to filter)"}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowMap(!showMap)} className="text-[var(--color-text-secondary)]">
              {showMap ? "Hide Map" : "Show Map"}
            </Button>
          </div>

          {showMap && (
            <div>
              {loadingMap ? (
                <div className="flex items-center justify-center h-[300px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
                </div>
              ) : (
                <PublicMiniMap
                  key={`${publicPotholes.length}-${reports.length}`}
                  potholes={publicPotholes}
                  userPotholes={userMapPotholes}
                  bounds={districtBounds}
                  height={300}
                />
              )}
            </div>
          )}
        </div>

        {/* My Reports */}
        <div className="flex items-center justify-between mb-6 mt-12">
          <h2 className="text-xl font-bold text-[var(--color-heading)]">My Reports</h2>
          <Button variant="ghost" size="sm" onClick={fetchReports} className="text-[var(--color-text-secondary)]">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-primary)]" /></div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-[var(--color-border)] rounded-2xl">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-secondary)] opacity-50" />
            <p className="text-[var(--color-text-secondary)]">No reports yet</p>
            <p className="text-xs text-[var(--color-text-secondary)] opacity-70 mt-1">Upload your first pothole photo above</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {reports.map((report, i) => (
                <motion.div key={report.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ delay: i * 0.05 }}>
                  <Card className="p-4 h-full bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-text-primary)] transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] font-mono">
                        <MapPin className="w-3 h-3" />
                        {Number(report.latitude).toFixed(4)}, {Number(report.longitude).toFixed(4)}
                      </div>
                      <Badge variant={statusMeta[report.status]?.color || "secondary"}>{statusMeta[report.status]?.label || report.status}</Badge>
                    </div>
                    {report.address_notes && <p className="text-sm text-[var(--color-text-secondary)] mb-2">{report.address_notes}</p>}
                    {report.block_id && <p className="text-xs text-[var(--color-text-secondary)] mb-2 font-mono">Block: {report.block_id}</p>}
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {new Date(report.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
