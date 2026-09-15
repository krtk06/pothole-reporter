"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Theme } from "./useTheme";

export interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
  className?: string;
}

/** Presentational theme switch. Each portal wires it to its own store/hook. */
export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-9 w-[70px] shrink-0 items-center rounded-full border border-hairline bg-sunken p-1 transition-colors duration-200 hover:border-hairline2",
        className
      )}
    >
      <span
        className={cn(
          "absolute h-7 w-7 rounded-full bg-surface shadow-1 transition-transform duration-300",
          isDark ? "translate-x-[34px]" : "translate-x-0"
        )}
        style={{ transitionTimingFunction: "cubic-bezier(.2,.8,.2,1)" }}
      />
      <span className="relative z-10 flex w-full items-center justify-between px-1.5">
        <Sun
          className={cn("h-4 w-4 transition-colors duration-200", isDark ? "text-ink3" : "text-signal")}
          strokeWidth={2}
        />
        <Moon
          className={cn("h-4 w-4 transition-colors duration-200", isDark ? "text-signal" : "text-ink3")}
          strokeWidth={2}
        />
      </span>
    </button>
  );
}
