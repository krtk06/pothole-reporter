"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import PixelIcon, { type PixelIconName } from "./PixelIcon";

/* ------------------------------------------------------------------ */
/* Window: beveled pixel panel with optional title bar                 */
/* ------------------------------------------------------------------ */
export function PixelWindow({
  title,
  icon,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  icon?: PixelIconName;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`px-window ${className}`}>
      {title && (
        <header className="px-titlebar flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="flex min-w-0 items-center gap-2">
            {icon && <PixelIcon name={icon} size={12} />}
            <span className="font-pixel truncate text-[9px]">{title}</span>
          </span>
          {actions ?? (
            <span className="flex items-center gap-1" aria-hidden>
              <i className="px-bevel block h-3 w-3 bg-[var(--px-panel)]" />
              <i className="px-bevel block h-3 w-3 bg-[var(--px-panel)]" />
            </span>
          )}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */
type PixelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "gold" | "green" | "red";
  icon?: PixelIconName;
};

export const PixelButton = forwardRef<HTMLButtonElement, PixelButtonProps>(
  function PixelButton(
    { variant = "default", icon, className = "", children, ...rest },
    ref
  ) {
    const tone =
      variant === "gold"
        ? "px-btn-gold"
        : variant === "green"
        ? "px-btn-green"
        : variant === "red"
        ? "px-btn-red"
        : "";
    return (
      <button
        ref={ref}
        className={`px-btn ${tone} inline-flex items-center justify-center gap-2 ${className}`}
        {...rest}
      >
        {icon && <PixelIcon name={icon} size={12} />}
        {children}
      </button>
    );
  }
);

/* ------------------------------------------------------------------ */
/* Lamp, Chip, Progress                                                */
/* ------------------------------------------------------------------ */
export function PixelLamp({
  status = "done",
  className = "",
}: {
  status?: "open" | "review" | "assigned" | "done";
  className?: string;
}) {
  return <span className={`lamp lamp-${status} ${className}`} aria-hidden />;
}

export function PixelChip({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`px-chip ${className}`}>{children}</span>;
}

export function PixelProgress({
  value,
  max = 100,
  blocks = 10,
  label,
  className = "",
}: {
  value: number;
  max?: number;
  blocks?: number;
  label?: string;
  className?: string;
}) {
  const filled = Math.max(
    0,
    Math.min(blocks, Math.round((value / max) * blocks))
  );
  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <span className="flex gap-[2px]">
        {Array.from({ length: blocks }).map((_, i) => (
          <i
            key={i}
            className="px-bevel block h-3 w-3"
            style={{
              background: i < filled ? "var(--px-green)" : "var(--px-well)",
            }}
          />
        ))}
      </span>
      {label && <span className="ledger text-[var(--px-dim)]">{label}</span>}
    </div>
  );
}
