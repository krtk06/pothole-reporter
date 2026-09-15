"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./motion";

/**
 * A soft light that follows the pointer across the ground. Visible only where
 * the theme defines `--spot-opacity` (the dark worlds).
 */
export default function Spotlight() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;

    const target = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.3 };
    const current = { ...target };

    const onMove = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
    };

    let raf = 0;
    const tick = () => {
      current.x += (target.x - current.x) * 0.1;
      current.y += (target.y - current.y) * 0.1;
      el.style.setProperty("--spot-x", `${current.x.toFixed(1)}px`);
      el.style.setProperty("--spot-y", `${current.y.toFixed(1)}px`);
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <div ref={ref} className="spot-field" aria-hidden />;
}
