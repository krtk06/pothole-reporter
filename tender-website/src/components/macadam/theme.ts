/**
 * Server-safe theme helpers. Kept out of `useTheme.ts` because that module is
 * `"use client"` and cannot export functions called during server rendering.
 */

export type Theme = "light" | "dark";

export const THEME_KEY = "theme";
export const THEME_EVENT = "macadam:theme";

export function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable — the class on <html> is still authoritative */
  }
  window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: theme }));
}

/**
 * Inline, render-blocking theme initialiser. Runs before first paint so the
 * correct theme is on <html> with no flash. `fallback` is the world default
 * (OPS = dark, BOARD = light).
 */
export function themeInitScript(fallback: Theme = "dark"): string {
  return `(function(){try{var s=localStorage.getItem("${THEME_KEY}");var d=(s==="dark"||s==="light")?s:"${fallback}";document.documentElement.classList.toggle("dark",d==="dark");}catch(e){document.documentElement.classList.toggle("dark","${fallback}"==="dark");}})();`;
}
