"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { PublicPothole } from "@/types";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { MapPin, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

const PublicMiniMap = dynamic(() => import("@/components/PublicMiniMap"), { ssr: false });

export default function Home() {
  const router = useRouter();
  const { user, logout } = useStore();
  const [mounted, setMounted] = useState(false);
  const [potholes, setPotholes] = useState<PublicPothole[]>([]);
  const [loadingMap, setLoadingMap] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const el = bgRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setMousePos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    api.getPublicPotholes()
      .then((data) => setPotholes(data.potholes || []))
      .catch(() => {})
      .finally(() => setLoadingMap(false));
  }, []);

  const verified = potholes.filter((p) => p.status === "verified").length;
  const pending = potholes.filter((p) => p.status === "pending").length;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div
      ref={bgRef}
      className="min-h-screen w-full relative overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(234,88,12,0.06) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(234,179,8,0.04) 0%, transparent 50%),
          var(--color-bg)
        `,
      }}
    >
      {/* Mouse glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000 ease-out"
        style={{
          background: `radial-gradient(800px circle at ${mousePos.x}% ${mousePos.y}%, rgba(234,88,12,0.07) 0%, transparent 60%)`,
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navbar */}
        <nav className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-[var(--color-border)] backdrop-blur-sm bg-[var(--color-bg)]/80 sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-text-primary)] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--color-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-bold text-[var(--color-heading)]">Pothole Reporter</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {mounted && user ? (
              <>
                <span className="text-sm text-[var(--color-text-secondary)] hidden sm:block">{user.name}</span>
                <Button variant="ghost" size="sm" onClick={() => router.push(user.role === "admin" ? "/admin" : "/dashboard")} className="text-[var(--color-text-secondary)]">
                  Dashboard
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-[var(--color-text-secondary)]">
                  Logout
                </Button>
              </>
            ) : (
              <Button
                onClick={() => router.push("/login")}
                className="relative inline-flex items-center overflow-hidden rounded-md bg-[var(--color-border)] px-5 py-2 text-sm font-normal text-white transition-all duration-300 hover:scale-105 hover:shadow-lg group/btn"
              >
                <span className="relative z-10">Login</span>
                <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-100%)] group-hover/btn:duration-700 group-hover/btn:[transform:skew(-13deg)_translateX(100%)]">
                  <div className="relative h-full w-8 bg-white/20" />
                </div>
              </Button>
            )}
          </div>
        </nav>

        {/* Hero */}
        <div
          className="text-center py-16 px-4 relative overflow-hidden bg-no-repeat bg-cover bg-center"
          style={{ backgroundImage: "url('https://raw.githubusercontent.com/prebuiltui/prebuiltui/main/assets/hero/gridBackground.png')" }}
        >
          <div className="relative z-10 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 border border-[var(--color-border)] rounded-full px-4 py-1.5 text-xs text-[var(--color-text-secondary)] mb-6 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live pothole tracking across India
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-[var(--color-heading)] mb-4">
              Fix India's{" "}
              <span className="text-gradient-orange">Roads</span>
            </h1>
            <p className="text-[var(--color-text-secondary)] text-lg max-w-2xl mx-auto mb-8">
              Crowdsourced pothole reporting, automated tender generation, and real-time road condition tracking. Together, we fix our streets.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button
                onClick={() => router.push("/login")}
                className="group/button relative inline-flex items-center overflow-hidden rounded-full bg-[var(--color-text-primary)] px-8 py-3 text-sm font-medium text-[var(--color-bg)] transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Report a Pothole
              </Button>
              <Button
                variant="outline"
                onClick={() => document.getElementById('live-map')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-full border-[var(--color-border)] text-[var(--color-text-secondary)] px-8 py-3 hover:border-[var(--color-text-primary)]"
              >
                View Live Map
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 md:px-12 py-8 border-y border-[var(--color-border)] bg-[var(--color-surface)]">
          {[
            { label: "Reported", value: pending + verified, icon: <AlertTriangle className="w-5 h-5" />, color: "text-amber-500" },
            { label: "Accepted", value: verified, icon: <CheckCircle2 className="w-5 h-5" />, color: "text-green-500" },
            { label: "States Covered", value: "36", icon: <MapPin className="w-5 h-5" />, color: "text-blue-400" },
            { label: "Avg Response", value: "48h", icon: <CheckCircle2 className="w-5 h-5" />, color: "text-purple-400" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
              <span className={color}>{icon}</span>
              <div>
                <p className="text-2xl font-bold text-[var(--color-heading)]">{value.toLocaleString()}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Live Map */}
        <div id="live-map" className="px-6 md:px-12 py-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--color-heading)]">Live Pothole Map</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Showing {potholes.length} reported potholes across India
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-[var(--color-text-secondary)]">Live</span>
            </div>
          </div>

          {loadingMap ? (
            <div className="flex flex-col items-center justify-center h-[400px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-primary)] mb-3" />
              <p className="text-sm text-[var(--color-text-secondary)]">Loading map data...</p>
            </div>
          ) : (
            <PublicMiniMap
              key={potholes.length}
              potholes={potholes}
              height={480}
              center={[20, 78]}
              zoom={5}
            />
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-6 md:px-12 py-16 text-center border-t border-[var(--color-border)] mt-auto">
          <h2 className="text-3xl font-bold text-[var(--color-heading)] mb-3">Spotted a pothole?</h2>
          <p className="text-[var(--color-text-secondary)] mb-6 max-w-lg mx-auto">
            Join thousands of citizens helping improve India's road infrastructure.
          </p>
          <Button
            onClick={() => router.push("/login")}
            className="group/button relative inline-flex items-center overflow-hidden rounded-full bg-[var(--color-text-primary)] px-8 py-3 text-sm font-medium text-[var(--color-bg)] transition-all duration-300 hover:scale-105 hover:shadow-lg"
          >
            Get Started — It's Free
          </Button>
        </div>
      </div>
    </div>
  );
}
