"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Cog, Loader2, MapPin, TrafficCone } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import AndhraLocationSelector, { AndhraLocationSelection } from "@/components/AndhraLocationSelector";
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
  Reveal,
  Surface,
  ThemeToggle,
} from "@/components/macadam";

const LoginMap = dynamic(() => import("@/components/LoginMap"), { ssr: false });

interface HeroMetrics {
  reports: number;
  fixed: number;
  inProgress: number;
}

/**
 * Live network totals for the hero metrics bar. Hidden until the fetch
 * resolves, on error, or when the network holds zero reports — the hero
 * never shows invented figures.
 */
function HeroMetricsBar() {
  const [metrics, setMetrics] = useState<HeroMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getPublicPotholes()
      .then((data: any) => {
        if (cancelled) return;
        const potholes = data.potholes ?? data.reports ?? [];
        let pending = 0;
        let fixed = 0;
        for (const p of potholes) {
          if (p.status === "fixed") fixed += 1;
          else if (p.status === "pending" || p.status === "verified") pending += 1;
        }
        if (pending + fixed > 0) setMetrics({ reports: pending + fixed, fixed, inProgress: pending });
      })
      .catch(() => {
        /* hidden — see docstring */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!metrics) return null;

  const cells = [
    { icon: TrafficCone, value: metrics.reports, label: "Reports" },
    { icon: CheckCircle2, value: metrics.fixed, label: "Fixed" },
    { icon: Cog, value: metrics.inProgress, label: "In Progress" },
  ];

  return (
    <dl className="mt-10 grid max-w-xl grid-cols-3">
      {cells.map((cell, index) => (
        <div
          key={cell.label}
          className={`flex items-center gap-3 ${index > 0 ? "border-l border-hairline pl-4 sm:pl-6" : ""}`}
        >
          <cell.icon className="h-5 w-5 shrink-0 text-signal" strokeWidth={2.25} />
          <div className="min-w-0">
            <dd className="font-mono text-[22px] font-bold leading-none tracking-tight text-ink sm:text-[28px]">
              <Counter value={cell.value} />
            </dd>
            <dt className="ledger mt-1.5">{cell.label}</dt>
          </div>
        </div>
      ))}
    </dl>
  );
}

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

      <section className="border-b border-hairline">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
          <Ignition step={110}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink2">
              Safer roads, stronger communities
            </p>
            <h1 className="mt-4 font-display text-[clamp(2.75rem,6vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.03em] text-ink">
              Smoother Roads
              <br />
              <span className="text-signal">Brighter Tomorrows</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink2">
              Report potholes. Track progress. Help build cleaner, safer roads for everyone.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <MagneticButton
                variant="primary"
                onClick={() =>
                  document.getElementById("gate")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Report a Pothole
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>
              <MagneticButton
                variant="secondary"
                onClick={() =>
                  document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                <MapPin className="h-4 w-4" />
                Explore Map
              </MagneticButton>
            </div>
            <HeroMetricsBar />
          </Ignition>

          <Reveal delay={120}>
            <figure className="relative overflow-hidden shadow-2 img-organic">
              <Image
                src={theme === "dark" ? "/hero/hero-dusk.png" : "/hero/hero-day.png"}
                alt="Pothole on an urban road at sunset with the city skyline behind it"
                width={1417}
                height={1110}
                priority
                sizes="(max-width: 1024px) 100vw, 55vw"
                className="h-auto w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
              />
              <figcaption className="absolute bottom-5 right-6 text-right font-display text-lg font-semibold italic leading-snug text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)]">
                Better roads ahead.
                <br />
                Together.
                <span className="mt-1 block h-1 w-24 rounded-full bg-signal ml-auto" aria-hidden />
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      <section id="gate" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-6">
            <Reveal>
              <Surface level={2}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-ink">Continue as guest</h2>
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
                    <h2 className="font-display text-xl font-semibold text-ink">Admin access</h2>
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
            <Surface level={1} padded={false} id="preview" className="h-full min-h-[360px] scroll-mt-24 overflow-hidden lg:min-h-[560px]">
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
