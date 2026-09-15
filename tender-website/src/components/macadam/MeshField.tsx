"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./motion";

const MESH_BACKGROUND = [
  "radial-gradient(42% 52% at 18% 22%, rgb(var(--mesh-1)) 0%, transparent 62%)",
  "radial-gradient(46% 56% at 82% 28%, rgb(var(--mesh-2)) 0%, transparent 64%)",
  "radial-gradient(52% 60% at 56% 88%, rgb(var(--mesh-3)) 0%, transparent 66%)",
].join(", ");

/**
 * The living ground: a low-saturation mesh that drifts slowly and parallaxes
 * to the pointer. Pure CSS paint, rAF transform only — no canvas cost.
 */
export default function MeshField() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const onMove = (event: PointerEvent) => {
      target.x = (event.clientX / window.innerWidth - 0.5) * 2;
      target.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      current.x += (target.x - current.x) * 0.045;
      current.y += (target.y - current.y) * 0.045;
      const drift = Math.sin((now - start) / 11000) * 1.6;
      el.style.transform = `translate3d(${(current.x * 26 + drift).toFixed(2)}px, ${(
        current.y * 22 -
        drift
      ).toFixed(2)}px, 0) scale(1.06)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <div ref={ref} className="mesh-field" style={{ background: MESH_BACKGROUND }} aria-hidden />;
}
