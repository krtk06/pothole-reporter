"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./motion";
import { THEME_EVENT } from "./theme";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

const DPR_CAP = 1.5;
const LINK_RADIUS = 112;

function readSandRgb(): [number, number, number] {
  if (typeof window === "undefined") return [210, 208, 200];
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--sand-rgb").trim();
  const parts = raw.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
  return [210, 208, 200];
}

function particleCount(width: number, height: number): number {
  const base = Math.round((width * height) / 16000);
  return Math.max(48, Math.min(190, base));
}

/**
 * The aggregate: ambient sand particles that drift across the ground and are
 * pushed away by the pointer, then settle. One instance per app.
 */
export default function SandField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    let rgb = readSandRgb();
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let running = true;
    const pointer = { x: -9999, y: -9999 };

    const seed = () => {
      const count = particleCount(width, height);
      particles = Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.06 + Math.random() * 0.16;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 0.6 + Math.random() * 1.3,
          alpha: 0.35 + Math.random() * 0.5,
        };
      });
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
      for (const p of particles) {
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    };

    const step = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;

      for (const p of particles) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const dist2 = dx * dx + dy * dy;

        if (dist2 < LINK_RADIUS * LINK_RADIUS && dist2 > 0.001) {
          const dist = Math.sqrt(dist2);
          const force = (1 - dist / LINK_RADIUS) * 1.6;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        p.vx *= 0.955;
        p.vy *= 0.955;
        p.vx += (Math.random() - 0.5) * 0.02;
        p.vy += (Math.random() - 0.5) * 0.02;

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -4) p.x = width + 4;
        if (p.x > width + 4) p.x = -4;
        if (p.y < -4) p.y = height + 4;
        if (p.y > height + 4) p.y = -4;

        ctx.globalAlpha = p.alpha;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(step);
    };

    const onMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };

    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };

    const onTheme = () => {
      rgb = readSandRgb();
      if (reduced) drawStatic();
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduced && !running) {
        running = true;
        raf = requestAnimationFrame(step);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener(THEME_EVENT, onTheme);
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) {
      drawStatic();
    } else {
      raf = requestAnimationFrame(step);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener(THEME_EVENT, onTheme);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="sand-field" aria-hidden />;
}
