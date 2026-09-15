"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "px-boot-v1";
const STEPS = 8;

/**
 * Retro boot sequence: types the OS name, fills 8 progress blocks, stamps
 * SYSTEM READY, then slides away. Plays once per tab session and is
 * skippable with any click or key. Skipped entirely under reduced motion.
 */
export default function BootScreen() {
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(KEY) === "1") return;
    } catch {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try {
        window.sessionStorage.setItem(KEY, "1");
      } catch {}
      return;
    }
    setVisible(true);
  }, []);

  const finish = useCallback(() => {
    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {}
    setDone(true);
    window.setTimeout(() => setVisible(false), 220);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => {
      setStep((s) => {
        if (s >= STEPS) {
          window.clearInterval(id);
          window.setTimeout(finish, 420);
          return s;
        }
        return s + 1;
      });
    }, 110);
    return () => window.clearInterval(id);
  }, [visible, finish]);

  useEffect(() => {
    if (!visible) return;
    const onKey = () => finish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, finish]);

  if (!visible) return null;

  return (
    <div
      onClick={finish}
      className={`fixed inset-0 z-[9999] flex cursor-pointer flex-col items-center justify-center bg-[var(--px-void)] transition-transform duration-200 ease-linear ${
        done ? "-translate-y-full" : "translate-y-0"
      }`}
      role="presentation"
    >
      <div className="px-bg-grid absolute inset-0 opacity-60" aria-hidden />
      <div className="relative flex flex-col items-center px-6">
        <div className="px-window px-6 py-4">
          <div className="font-pixel text-center text-[13px] text-[var(--px-gold)] sm:text-[18px]">
            AP ROADS OS
          </div>
          <div className="ledger mt-2 text-center text-[var(--px-dim)]">
            MUNICIPAL ROAD-WORKS TERMINAL v1.0
          </div>
        </div>

        <div className="mt-6 flex gap-1">
          {Array.from({ length: STEPS }).map((_, i) => (
            <span
              key={i}
              className="px-bevel block h-4 w-4"
              style={{
                background:
                  i < step ? "var(--px-green)" : "var(--px-well)",
              }}
            />
          ))}
        </div>

        <div className="ledger mt-4 text-[var(--px-dim)]">
          {step >= STEPS ? "SYSTEM READY — CLICK TO CONTINUE" : "LOADING MUNICIPAL RUNTIME..."}
        </div>
      </div>
    </div>
  );
}
