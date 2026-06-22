"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { ThemeToggle as ThemeToggleNew } from "@/components/ui/theme-toggle";

const LoginMap = dynamic(() => import("@/components/LoginMap"), { ssr: false });

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser, setToken } = useStore();
  const bgRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  // Fluid mouse tracking on the background
  useEffect(() => {
    const el = bgRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePos({ x, y });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = isLogin
        ? await api.login(email, password)
        : await api.register(name, email, password, phone || undefined);
      setToken(data.accessToken);
      setUser(data.user);
      router.push(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
        backgroundPosition: "center, center, center, center, center",
        backgroundRepeat: "no-repeat, no-repeat, no-repeat, no-repeat, repeat",
      }}
    >
      {/* Fluid gradient overlay that follows mouse */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000 ease-out"
        style={{
          background: `radial-gradient(900px circle at ${mousePos.x}% ${mousePos.y}%, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.04) 30%, transparent 60%)`,
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top nav */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-text-primary)] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--color-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-bold text-[var(--color-heading)]">Pothole Reporter</span>
          </div>
          <ThemeToggleNew />
        </div>

        {/* Hero + Auth centered */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl flex flex-col lg:flex-row justify-between rounded-2xl overflow-hidden shadow-2xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-sm">
            
            {/* Left: Auth Form */}
            <div className="w-full lg:w-1/2 px-6 lg:px-12 py-10 lg:py-16 relative">
              <div className="h-full flex flex-col justify-center">
                <form onSubmit={handleSubmit} className="text-center grid gap-5">
                  <div className="grid gap-4 mb-2">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--color-heading)]">
                      {isLogin ? "Welcome Back" : "Join Us"}
                    </h1>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {isLogin ? "Sign in to report potholes" : "Create an account to start reporting"}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                      <div className="h-px flex-1 bg-[var(--color-border)]" />
                      <span>or use your account</span>
                      <div className="h-px flex-1 bg-[var(--color-border)]" />
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {!isLogin && (
                      <input
                        placeholder="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="peer relative z-10 border-2 border-[var(--color-border)] h-12 w-full rounded-md bg-[var(--color-bg)] px-4 font-thin outline-none transition-all duration-200 focus:border-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
                        required
                      />
                    )}
                    <input
                      placeholder="Email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="peer relative z-10 border-2 border-[var(--color-border)] h-12 w-full rounded-md bg-[var(--color-bg)] px-4 font-thin outline-none transition-all duration-200 focus:border-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
                      required
                    />
                    <input
                      placeholder="Password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="peer relative z-10 border-2 border-[var(--color-border)] h-12 w-full rounded-md bg-[var(--color-bg)] px-4 font-thin outline-none transition-all duration-200 focus:border-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
                      required
                      minLength={8}
                    />
                    {!isLogin && (
                      <input
                        placeholder="Phone (optional)"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="peer relative z-10 border-2 border-[var(--color-border)] h-12 w-full rounded-md bg-[var(--color-bg)] px-4 font-thin outline-none transition-all duration-200 focus:border-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
                      />
                    )}
                  </div>

                  {isLogin && (
                    <button type="button" className="font-light text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                      Forgot your password?
                    </button>
                  )}

                  {error && <p className="text-xs text-red-400">{error}</p>}

                  <div className="flex gap-3 justify-center">
                    <button
                      type="submit"
                      disabled={loading}
                      className="group/button relative inline-flex items-center overflow-hidden rounded-md bg-[var(--color-border)] px-8 py-2.5 text-sm font-normal text-white transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50"
                    >
                      <span className="relative z-10">
                        {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
                      </span>
                      <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-100%)] group-hover/button:duration-1000 group-hover/button:[transform:skew(-13deg)_translateX(100%)]">
                        <div className="relative h-full w-8 bg-white/20" />
                      </div>
                    </button>
                  </div>

                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                      type="button"
                      onClick={() => { setIsLogin(!isLogin); setError(""); }}
                      className="text-[var(--color-text-primary)] hover:underline font-medium"
                    >
                      {isLogin ? "Register" : "Sign In"}
                    </button>
                  </p>
                </form>
              </div>
            </div>

            {/* Right: Map */}
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
