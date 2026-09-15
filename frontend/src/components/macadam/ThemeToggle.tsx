"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Theme } from "./theme";

export interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
  className?: string;
}

/**
 * Presentational theme switch. Its visuals are driven by the `.dark` class
 * (set before paint by the inline theme script), so the server and client
 * markup agree and there is no hydration mismatch.
 */
export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={onToggle}
      suppressHydrationWarning
      className={cn(
        "relative inline-flex h-9 w-[70px] shrink-0 items-center rounded-full border border-hairline bg-sunken p-1 transition-colors duration-200 hover:border-hairline2",
        className
      )}
    >
      <span className="theme-thumb absolute h-7 w-7 rounded-full bg-surface shadow-1" />
      <span className="relative z-10 flex w-full items-center justify-between px-1.5">
        <Sun className="theme-sun h-4 w-4" strokeWidth={2} />
        <Moon className="theme-moon h-4 w-4" strokeWidth={2} />
      </span>
    </button>
  );
}
