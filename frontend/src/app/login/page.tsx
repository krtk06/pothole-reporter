"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import AndhraLocationSelector, { AndhraLocationSelection } from "@/components/AndhraLocationSelector";
import PixelIcon from "@/components/pixel/PixelIcon";
import PixelSprite from "@/components/pixel/PixelSprite";
import BrandLogo from "@/components/pixel/BrandLogo";
import { PixelButton } from "@/components/pixel/PixelUI";

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

  const continueAsGuest = async () => {
    setError("");
    if (!selectedLocation.district || !selectedLocation.subdistrict || !selectedLocation.village) {
      setError("Select district, mandal, and city/village to continue as guest.");
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
      setError(err.message || "Unable to resolve the selected city/village.");
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

  const inputClass =
    "px-well h-11 w-full px-3 font-body text-sm text-body outline-none placeholder:text-dim";

  return (
    <div className="h-[100dvh] overflow-hidden">
      <div className="flex h-full min-h-0 flex-col">
        <header className="px-titlebar flex shrink-0 items-center justify-between gap-2 px-3 py-2">
          <a href="/login" className="flex min-w-0 items-center gap-2">
            <BrandLogo
              src="/brand/pothole-reporter.png"
              alt="Pothole Reporter"
              size={32}
              fallback={
                <span className="px-bevel flex h-6 w-6 shrink-0 items-center justify-center bg-[var(--px-panel)] text-[var(--px-text)]">
                  <PixelSprite name="worker" size={16} alt="Pothole Reporter" />
                </span>
              }
            />
            <span className="font-pixel truncate text-[10px]">Pothole Reporter</span>
          </a>
          <ThemeToggle />
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center p-3 md:p-6">
          <div className="px-window flex h-full max-h-[720px] w-full max-w-5xl flex-col overflow-hidden lg:flex-row">
            {/* Left — guest + admin */}
            <div className="px-scroll min-h-0 w-full overflow-y-auto lg:h-full lg:w-1/2">
              <div className="grid gap-4 p-4 md:p-6">
                <div className="grid gap-2 text-center">
                  <h1 className="font-pixel text-sm md:text-base">Continue as Guest</h1>
                  <p className="ledger text-gold">Official road-report gate • No sign-up</p>
                  <p className="text-sm text-dim">
                    Select your city/village to view live pothole data. No user record will be created.
                  </p>
                </div>

                <div className="px-well p-3">
                  <AndhraLocationSelector
                    value={selectedLocation}
                    onChange={(next) => setSelectedLocation(next)}
                    label
                  />
                </div>

                <PixelButton
                  variant="gold"
                  icon={loadingGuest ? undefined : "pin"}
                  onClick={continueAsGuest}
                  disabled={loadingGuest}
                  className="w-full"
                >
                  {loadingGuest ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Resolving area...
                    </>
                  ) : (
                    "Continue as Guest"
                  )}
                </PixelButton>

                <div className="flex items-center gap-3">
                  <span className="tape-thin flex-1" aria-hidden />
                  <span className="ledger text-dim">Admin Access</span>
                  <span className="tape-thin flex-1" aria-hidden />
                </div>

                <form onSubmit={handleAdminLogin} className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <PixelIcon name="stamp" size={12} className="text-gold" />
                    <span className="font-pixel text-[10px]">Admin Login</span>
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
                      className="font-pixel text-[9px] text-dim hover:text-body text-left"
                    >
                      Forgot your password?
                    </button>
                    <PixelButton type="submit" variant="green" disabled={loadingAdmin}>
                      {loadingAdmin ? "Signing in..." : "Sign In"}
                    </PixelButton>
                  </div>
                </form>

                {error && <p className="text-center text-sm text-red">{error}</p>}
              </div>
            </div>

            {/* Right — map (desktop) */}
            <div className="relative hidden min-h-0 w-1/2 overflow-hidden border-l-2 border-[var(--px-line)] lg:block">
              <LoginMap />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
