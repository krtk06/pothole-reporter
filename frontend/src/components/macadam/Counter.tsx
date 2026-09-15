"use client";

import { useEffect, useRef, useState } from "react";
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

/** Counts up to its value when it enters the viewport. Tabular by default. */
export function Counter({
  value,
  duration = 1200,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || started.current) continue;
          started.current = true;
          io.disconnect();
          const start = performance.now();
          const animate = (now: number) => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(value * eased);
            if (p < 1) raf = requestAnimationFrame(animate);
          };
          raf = requestAnimationFrame(animate);
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

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
