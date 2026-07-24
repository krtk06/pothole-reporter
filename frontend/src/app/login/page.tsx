"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2, MapPin, Shield } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import AndhraLocationSelector, { AndhraLocationSelection } from "@/components/AndhraLocationSelector";

const LoginMap = dynamic(() => import("@/components/LoginMap"), { ssr: false });

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<AndhraLocationSelection>({
    district: null,
    subdistrict: null,
    village: null,
  });
  const [error, setError] = useState("");
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const router = useRouter();
  const { setUser, setLocation, setAdministrativeArea } = useStore();
  const bgRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

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

  const continueAsGuest = async () => {
    setError("");
    if (!selectedLocation.district || !selectedLocation.subdistrict || !selectedLocation.village) {
      setError("Select district, mandal, and village/city to continue as guest.");
      return;
    }

    setLoadingGuest(true);
    try {
      const { area } = await api.getCurrentAdministrativeArea(selectedLocation.village);
      setAdministrativeArea(area);
      setUser({
        id: "guest",
        name: "Guest",
        email: "",
        role: "public",
        is_guest: true,
        theme_preference: "dark",
        state: area.stateName || "Andhra Pradesh",
        district: area.districtName || selectedLocation.district.name,
        mandal: area.subdistrictName || selectedLocation.subdistrict.name,
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Unable to resolve the selected village/city.");
    } finally {
      setLoadingGuest(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoadingAdmin(true);
    try {
      const data = await api.login(email, password);
      if (data.user.role !== "admin") {
        await api.logout();
        setError("Public web users must continue as guest.");
        return;
      }
      setUser(data.user);
      if (data.user.state) {
        setLocation(data.user.state, data.user.district || "", data.user.mandal || "");
      }
      router.push("/admin");
    } catch (err: any) {
      setError(err.message || "Unable to sign in");
    } finally {
      setLoadingAdmin(false);
    }
  };

  const inputClass = "peer relative z-10 border-2 border-[var(--color-border)] h-12 w-full rounded-md bg-[var(--color-bg)] px-4 font-thin outline-none transition-all duration-200 focus:border-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] text-sm";

  return (
    <div
      ref={bgRef}
      className="min-h-screen w-full relative overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(59,130,246,0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 80%, rgba(34,197,94,0.06) 0%, transparent 50%),
          url('https://raw.githubusercontent.com/prebuiltui/prebuiltui/main/assets/hero/gridBackground.png'),
          var(--color-bg)
        `,
        backgroundSize: "cover, cover, cover, cover, auto",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat, no-repeat, no-repeat, no-repeat, repeat",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000 ease-out"
        style={{
          background: `radial-gradient(900px circle at ${mousePos.x}% ${mousePos.y}%, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.04) 30%, transparent 60%)`,
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="flex items-center justify-between px-6 py-4">
          <a href="/login" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-text-primary)] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--color-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-bold text-[var(--color-heading)]">Pothole Reporter</span>
          </a>
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl flex flex-col lg:flex-row justify-between rounded-2xl overflow-hidden shadow-2xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-sm">
            <div className="w-full lg:w-1/2 px-6 lg:px-10 py-10 lg:py-12 overflow-y-auto max-h-[90vh]">
              <div className="grid gap-6">
                <div className="text-center grid gap-2">
                  <h1 className="text-3xl font-extrabold text-[var(--color-heading)]">Continue as Guest</h1>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Select your area to view live pothole data. No user record will be created.
                  </p>
                </div>

                <div className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-bg)]">
                  <AndhraLocationSelector
                    value={selectedLocation}
                    onChange={(next) => setSelectedLocation(next)}
                    label
                  />
                </div>

                <button
                  type="button"
                  onClick={continueAsGuest}
                  disabled={loadingGuest}
                  className="group/button relative inline-flex items-center justify-center overflow-hidden rounded-md bg-[var(--color-border)] px-8 py-3 text-sm font-normal text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50"
                >
                  {loadingGuest ? (
                    <Loader2 className="relative z-10 mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="relative z-10 mr-2 h-4 w-4" />
                  )}
                  <span className="relative z-10">{loadingGuest ? "Resolving area..." : "Continue as Guest"}</span>
                  <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-100%)] group-hover/button:duration-1000 group-hover/button:[transform:skew(-13deg)_translateX(100%)]">
                    <div className="relative h-full w-8 bg-white/20" />
                  </div>
                </button>

                <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                  <div className="h-px flex-1 bg-[var(--color-border)]" />
                  <span>admin access</span>
                  <div className="h-px flex-1 bg-[var(--color-border)]" />
                </div>

                <form onSubmit={handleAdminLogin} className="grid gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-heading)]">
                    <Shield className="h-4 w-4 text-[var(--color-text-secondary)]" />
                    Admin Login
                  </div>
                  <input
                    placeholder="Admin email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    required
                  />
                  <input
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    required
                    minLength={8}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => router.push("/forgot-password")}
                      className="font-light text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-left"
                    >
                      Forgot your password?
                    </button>
                    <button
                      type="submit"
                      disabled={loadingAdmin}
                      className="rounded-md border border-[var(--color-border)] px-5 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-primary)] disabled:opacity-50"
                    >
                      {loadingAdmin ? "Signing in..." : "Sign In"}
                    </button>
                  </div>
                </form>

                {error && <p className="text-xs text-red-400 text-center">{error}</p>}
              </div>
            </div>

            <div className="hidden lg:block w-1/2 relative overflow-hidden rounded-r-2xl" style={{ minHeight: "600px" }}>
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-surface)] via-transparent to-transparent z-10 pointer-events-none" />
              <LoginMap />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
