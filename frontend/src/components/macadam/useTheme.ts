"use client";

import { useCallback, useEffect, useState } from "react";

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
 * Standalone theme controller (used by the tender portal, which has no store).
 * Frontend keeps its zustand store as the authority and passes theme/onToggle
 * into the presentational ThemeToggle instead.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(readTheme());
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<Theme>).detail;
      setThemeState(detail ?? readTheme());
    };
    window.addEventListener(THEME_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(THEME_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(readTheme() === "dark" ? "light" : "dark");
    setThemeState(readTheme());
  }, []);

  return { theme, setTheme, toggleTheme };
}

/**
 * Inline, render-blocking theme initialiser. Runs before first paint so the
 * correct theme is on <html> with no flash. `fallback` is the world's default
 * (OPS = dark, BOARD = light).
 */
export function themeInitScript(fallback: Theme = "dark"): string {
  return `(function(){try{var s=localStorage.getItem("${THEME_KEY}");var d=(s==="dark"||s==="light")?s:"${fallback}";document.documentElement.classList.toggle("dark",d==="dark");}catch(e){document.documentElement.classList.toggle("dark","${fallback}"==="dark");}})();`;
}
