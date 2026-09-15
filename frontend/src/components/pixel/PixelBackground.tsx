"use client";

import { useEffect, useRef } from "react";

/**
 * Parallax pixel background: grid floor, star field, skyline and road.
 * Layers drift toward the pointer and keep drifting slowly on their own.
 * Fully disabled under prefers-reduced-motion.
 */
export default function PixelBackground() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;

    const onMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const tick = () => {
      curX += (targetX - curX) * 0.05;
      curY += (targetY - curY) * 0.05;
      const el = wrapRef.current;
      if (el) {
        el.style.setProperty("--mx", curX.toFixed(3));
        el.style.setProperty("--my", curY.toFixed(3));
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="px-bg" ref={wrapRef} aria-hidden>
      <div className="px-bg-layer px-bg-grid" />
      <div
        className="px-bg-layer px-bg-stars"
        style={{
          transform:
            "translate3d(calc(var(--mx, 0) * -10px), calc(var(--my, 0) * -10px), 0)",
        }}
      />
      <div
        className="px-bg-layer px-bg-skyline"
        style={{
          transform: "translate3d(calc(var(--mx, 0) * -22px), 0, 0)",
        }}
      />
      <div
        className="px-bg-layer px-bg-road"
        style={{
          transform:
            "translate3d(calc(var(--mx, 0) * -44px), calc(var(--my, 0) * 4px), 0)",
        }}
      />
    </div>
  );
}
