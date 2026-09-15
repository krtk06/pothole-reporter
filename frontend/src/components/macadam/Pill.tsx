import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type PillTone = "neutral" | "accent" | "ok" | "warn" | "bad" | "info";

const TONE: Record<PillTone, string> = {
  neutral: "var(--text-2)",
  accent: "var(--accent)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  bad: "var(--bad)",
  info: "var(--info)",
};

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  pulse?: boolean;
  dot?: boolean;
  mono?: boolean;
}

/** A status or tag pill: a semantic dot plus a label, always the same shape. */
export function Pill({
  tone = "neutral",
  pulse = false,
  dot = true,
  mono = false,
  className,
  children,
  ...rest
}: PillProps) {
  const color = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
        mono && "font-mono tracking-tight",
        className
      )}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 26%, transparent)`,
      }}
      {...rest}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", pulse && "dot-pulse")}
          style={{ background: color }}
        />
      )}
      {children}
    </span>
  );
}
