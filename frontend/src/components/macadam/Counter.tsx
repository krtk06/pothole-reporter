"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "./motion";

export interface CounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * Counts up to its value on first reveal, and animates again on every later
 * value change (so a refresh, or data that arrives after mount, updates the
 * reading instead of freezing at zero). Tabular by default.
 */
export function Counter({
  value,
  duration = 1200,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const displayRef = useRef(0);
  const revealedRef = useRef(false);
  const valueRef = useRef(value);
  const rafRef = useRef(0);
  const [display, setDisplay] = useState(0);

  valueRef.current = value;

  const animateTo = useCallback(
    (to: number) => {
      if (prefersReducedMotion()) {
        displayRef.current = to;
        setDisplay(to);
        return;
      }
      const from = displayRef.current;
      if (from === to) {
        setDisplay(to);
        return;
      }
      cancelAnimationFrame(rafRef.current);
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        const next = from + (to - from) * eased;
        displayRef.current = next;
        setDisplay(next);
        if (p < 1) rafRef.current = requestAnimationFrame(step);
        else displayRef.current = to;
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [duration]
  );

  // First reveal: wait until the reading is on screen, then animate.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      revealedRef.current = true;
      animateTo(valueRef.current);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !revealedRef.current) {
            revealedRef.current = true;
            io.disconnect();
            animateTo(valueRef.current);
          }
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [animateTo]);

  // Subsequent value changes (data arriving after mount, refreshes).
  useEffect(() => {
    if (!revealedRef.current) return;
    animateTo(value);
  }, [value, animateTo]);

  return (
    <span ref={ref} className={cn("tnum", className)}>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
