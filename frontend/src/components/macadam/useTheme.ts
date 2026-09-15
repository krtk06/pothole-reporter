"use client";

import { useCallback, useEffect, useState } from "react";
import { applyTheme, readTheme, THEME_EVENT, type Theme } from "./theme";

export type { Theme } from "./theme";
export { applyTheme, readTheme, themeInitScript, THEME_KEY, THEME_EVENT } from "./theme";

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
