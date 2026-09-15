"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./motion";
import { THEME_EVENT } from "./theme";

export interface SandHeroProps {
  className?: string;
  /** particle budget; scaled down on small viewports */
  density?: number;
  onComplete?: () => void;
}

interface Grain {
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  alpha: number;
  target: number;
  size: number;
}

type Phase = "coalesce" | "hold" | "disperse" | "done";

const COALESCE_MS = 1250;
const HOLD_MS = 700;
const DISPERSE_MS = 900;

function readRgb(name: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = raw.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  return parts.length >= 3 ? [parts[0], parts[1], parts[2]] : fallback;
}

/**
 * The hero moment: scattered aggregate coalesces into a pothole silhouette,
 * holds, then disperses back into the ground. Skippable; static under
 * reduced motion.
 */
export default function SandHero({ className, density = 520, onComplete }: SandHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    let grains: Grain[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let phase: Phase = "coalesce";
    let phaseStart = 0;
    let sand = readRgb("--sand-rgb", [210, 208, 200]);
    let accent = readRgb("--accent", [232, 162, 60]);

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(raf);
      onComplete?.();
    };

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cx = width / 2;
      const cy = height / 2;
      const base = Math.min(width, height) * 0.3;
      const count = Math.max(220, Math.min(density, Math.round((width * height) / 900)));

      // irregular pothole: a closed curve with layered radial noise
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI * 2;
      const c = Math.random() * Math.PI * 2;
      const rim = (theta: number) =>
        base * (1 + 0.16 * Math.sin(3 * theta + a) + 0.09 * Math.sin(5 * theta + b) + 0.05 * Math.sin(9 * theta + c));

      grains = Array.from({ length: count }, () => {
        const theta = Math.random() * Math.PI * 2;
        const onRim = Math.random() < 0.62;
        const radius = rim(theta) * (onRim ? 0.92 + Math.random() * 0.12 : Math.random() * 0.85);
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          tx: cx + Math.cos(theta) * radius,
          ty: cy + Math.sin(theta) * radius,
          vx: 0,
          vy: 0,
          alpha: 0,
          target: onRim ? 0.5 + Math.random() * 0.45 : 0.16 + Math.random() * 0.3,
          size: 0.8 + Math.random() * 1.4,
        };
      });

      // pre-seed outward velocities used by the disperse phase
      grains.forEach((g) => {
        const dx = g.tx - cx;
        const dy = g.ty - cy;
        const d = Math.hypot(dx, dy) || 1;
        g.vx = (dx / d) * 0.2;
        g.vy = (dy / d) * 0.2;
      });
    };

    const renderStatic = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `rgb(${sand[0]} ${sand[1]} ${sand[2]})`;
      for (const g of grains) {
        ctx.globalAlpha = g.alpha;
        ctx.fillRect(g.x, g.y, g.size, g.size);
      }
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      if (!phaseStart) phaseStart = now;
      const t = now - phaseStart;
      ctx.clearRect(0, 0, width, height);

      if (phase === "coalesce") {
        const p = Math.min(1, t / COALESCE_MS);
        const eased = 1 - Math.pow(1 - p, 3);
        for (const g of grains) {
          g.x += (g.tx - g.x) * (0.02 + eased * 0.25);
          g.y += (g.ty - g.y) * (0.02 + eased * 0.25);
          g.alpha = eased * g.target;
        }
        if (p >= 1) {
          phase = "hold";
          phaseStart = now;
        }
      } else if (phase === "hold") {
        for (const g of grains) {
          g.x += Math.sin((now + g.tx) * 0.01) * 0.05;
          g.y += Math.cos((now + g.ty) * 0.01) * 0.05;
          g.alpha = g.target;
        }
        if (t >= HOLD_MS) {
          phase = "disperse";
          phaseStart = now;
          for (const g of grains) {
            const angle = Math.atan2(g.ty - height / 2, g.tx - width / 2);
            const speed = 0.6 + Math.random() * 1.5;
            g.vx = Math.cos(angle) * speed;
            g.vy = Math.sin(angle) * speed;
          }
        }
      } else if (phase === "disperse") {
        const p = Math.min(1, t / DISPERSE_MS);
        for (const g of grains) {
          g.x += g.vx;
          g.y += g.vy;
          g.vx *= 0.995;
          g.vy *= 0.995;
          g.alpha = g.target * (1 - p);
        }
        if (p >= 1) {
          ctx.clearRect(0, 0, width, height);
          phase = "done";
          finish();
          return;
        }
      }

      // sand body
      ctx.fillStyle = `rgb(${sand[0]} ${sand[1]} ${sand[2]})`;
      let accentMarks = 0;
      for (const g of grains) {
        if (g.alpha <= 0.001) continue;
        ctx.globalAlpha = g.alpha;
        ctx.fillRect(g.x, g.y, g.size, g.size);
        if (phase !== "disperse" && g.alpha > 0.7 && accentMarks < 22) {
          ctx.globalAlpha = g.alpha * 0.8;
          ctx.fillStyle = `rgb(${accent[0]} ${accent[1]} ${accent[2]})`;
          ctx.fillRect(g.x, g.y, g.size, g.size);
          ctx.fillStyle = `rgb(${sand[0]} ${sand[1]} ${sand[2]})`;
          accentMarks += 1;
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };

    const onResize = () => {
      build();
      if (reduced) renderStatic();
    };

    const skip = () => {
      if (phase === "done") return;
      if (reduced) {
        phase = "done";
        finish();
        return;
      }
      phase = "done";
      ctx.clearRect(0, 0, width, height);
      finish();
    };

    const onTheme = () => {
      sand = readRgb("--sand-rgb", sand);
      accent = readRgb("--accent", accent);
      if (reduced) renderStatic();
    };

    build();

    if (reduced) {
      for (const g of grains) {
        g.x = g.tx;
        g.y = g.ty;
        g.alpha = g.target;
      }
      renderStatic();
      phase = "done";
      finish();
    } else {
      window.addEventListener("pointerdown", skip, { once: true });
      window.addEventListener("keydown", skip, { once: true });
      raf = requestAnimationFrame(frame);
    }

    window.addEventListener("resize", onResize);
    window.addEventListener(THEME_EVENT, onTheme);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener(THEME_EVENT, onTheme);
    };
  }, [density, onComplete]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
