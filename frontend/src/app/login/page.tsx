"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import AndhraLocationSelector, { AndhraLocationSelection } from "@/components/AndhraLocationSelector";
import {
  Field,
  Ignition,
  Input,
  Logo,
  MagneticButton,
  NavBar,
  NavInner,
  NavSpacer,
  Pill,
  Reveal,
  SandHero,
  Surface,
  ThemeToggle,
} from "@/components/macadam";

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
  const { setUser, setLocation, setAdministrativeArea, theme, toggleTheme } = useStore();

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

  return (
    <main className="min-h-dvh">
      <NavBar>
        <NavInner>
          <Logo src="/brand/pothole-reporter.png" name="Pothole Reporter" tagline="Road Works" />
          <NavSpacer />
          <Pill tone="neutral" className="hidden sm:inline-flex">
            No sign-up required
          </Pill>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </NavInner>
      </NavBar>

      <section className="relative overflow-hidden border-b border-hairline">
        <div className="pointer-events-none absolute inset-0">
          <SandHero className="h-full w-full" />
        </div>
        <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <Ignition step={110}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink3">
              Govt of Andhra Pradesh • Roads &amp; Buildings
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.4rem,5.4vw,4.25rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink">
              Report a pothole. Watch it become a funded repair.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink2">
              Pick your district, mandal, and village to see live road conditions on the map —
              no account, no record created.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <MagneticButton
                variant="primary"
                onClick={() =>
                  document.getElementById("gate")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Select your area
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>
              <MagneticButton
                variant="secondary"
                onClick={() =>
                  document.getElementById("admin")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                <ShieldCheck className="h-4 w-4" />
                Admin sign in
              </MagneticButton>
            </div>
          </Ignition>
        </div>
      </section>

      <section id="gate" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-6">
            <Reveal>
              <Surface level={2}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold text-ink">Continue as guest</h2>
                    <p className="mt-1 text-sm text-ink2">
                      Select your location to view live pothole data.
                    </p>
                  </div>
                  <Pill tone="ok" pulse>
                    Public
                  </Pill>
                </div>

                <div className="mt-6 rule" />

                <div className="mt-6">
                  <AndhraLocationSelector
                    value={selectedLocation}
                    onChange={(next) => setSelectedLocation(next)}
                    label
                  />
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <p className="text-xs text-ink3">No user record will be created.</p>
                  <MagneticButton
                    variant="primary"
                    onClick={continueAsGuest}
                    disabled={loadingGuest}
                  >
                    {loadingGuest ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Resolving area
                      </>
                    ) : (
                      <>
                        Continue as guest
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </MagneticButton>
                </div>
              </Surface>
            </Reveal>

            <Reveal delay={80}>
              <Surface level={2} id="admin" className="scroll-mt-24">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold text-ink">Admin access</h2>
                    <p className="mt-1 text-sm text-ink2">
                      Seeded staff accounts only — no public registration.
                    </p>
                  </div>
                  <Pill tone="info">Staff</Pill>
                </div>

                <div className="mt-6 rule" />

                <form onSubmit={handleAdminLogin} className="mt-6 space-y-4">
                  <Field label="Admin email" htmlFor="admin-email" required>
                    <Input
                      id="admin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@department.gov.in"
                      autoComplete="email"
                      required
                    />
                  </Field>
                  <Field label="Password" htmlFor="admin-password" required>
                    <Input
                      id="admin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      minLength={8}
                    />
                  </Field>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                      href="/forgot-password"
                      className="text-sm font-medium text-ink2 underline-offset-4 transition-colors hover:text-ink hover:underline"
                    >
                      Forgot your password?
                    </Link>
                    <MagneticButton type="submit" variant="secondary" disabled={loadingAdmin}>
                      {loadingAdmin ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in
                        </>
                      ) : (
                        "Sign in"
                      )}
                    </MagneticButton>
                  </div>
                </form>
              </Surface>
            </Reveal>

            {error && (
              <Reveal>
                <div className="rounded-lg border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
                  {error}
                </div>
              </Reveal>
            )}
          </div>

          <Reveal delay={120} className="min-h-[320px]">
            <Surface level={1} padded={false} className="h-full min-h-[360px] overflow-hidden lg:min-h-[560px]">
              <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink3">
                  Live area preview
                </p>
                <Pill tone="neutral" mono>
                  OSM
                </Pill>
              </div>
              <div className="relative h-[calc(100%-49px)] min-h-[320px]">
                <LoginMap />
              </div>
            </Surface>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink3 sm:px-6">
          <span>Pothole Reporter — crowdsourced road maintenance for Andhra Pradesh.</span>
          <span className="font-mono">est. 2026</span>
        </div>
      </footer>
    </main>
  );
}
