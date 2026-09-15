"use client";

import { useEffect } from "react";

/**
 * Pixel cursor trail: small square crumbs that fall and fade as the pointer
 * moves. Desktop pointer only; disabled for reduced motion and touch.
 */
export default function PixelCursor() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:9998;overflow:hidden";
    document.body.appendChild(layer);

    const colors = [
      "var(--px-gold)",
      "var(--px-green)",
      "var(--px-blue)",
      "var(--px-orange)",
    ];
    let last = 0;
    let i = 0;

    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - last < 65) return;
      last = now;
      const crumb = document.createElement("span");
      const size = 4 + (i % 2) * 2;
      crumb.style.cssText = `position:absolute;left:${e.clientX}px;top:${e.clientY}px;width:${size}px;height:${size}px;background:${
        colors[i++ % colors.length]
      };transform:translate(-50%,-50%);animation:px-crumb .5s steps(5) forwards`;
      layer.appendChild(crumb);
      window.setTimeout(() => crumb.remove(), 520);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      layer.remove();
    };
  }, []);

  return null;
}
