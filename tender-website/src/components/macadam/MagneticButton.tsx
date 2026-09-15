"use client";

import { forwardRef, useRef, type ButtonHTMLAttributes, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "./motion";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "ok" | "danger" | "quiet";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-signal text-onsignal hover:bg-signal2",
  secondary: "border-hairline bg-surface text-ink hover:bg-sunken",
  ghost: "border-transparent bg-transparent text-ink2 hover:bg-sunken hover:text-ink",
  ok: "border-transparent bg-ok text-white hover:brightness-105",
  danger: "border-transparent bg-bad text-white hover:brightness-105",
  quiet: "border-hairline bg-sunken text-ink hover:bg-surface",
};

export interface MagneticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  magnetic?: boolean;
  block?: boolean;
}

export const MagneticButton = forwardRef<HTMLButtonElement, MagneticButtonProps>(
  function MagneticButton(
    { variant = "secondary", magnetic = true, block = false, className, children, onPointerMove, ...rest },
    forwardedRef
  ) {
    const localRef = useRef<HTMLButtonElement | null>(null);
    const innerRef = useRef<HTMLSpanElement | null>(null);

    const setRefs = (node: HTMLButtonElement | null) => {
      localRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    const handleMove = (event: PointerEvent<HTMLButtonElement>) => {
      onPointerMove?.(event);
      if (!magnetic || prefersReducedMotion()) return;
      const el = localRef.current;
      const inner = innerRef.current;
      if (!el || !inner) return;
      const rect = el.getBoundingClientRect();
      const x = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
      const y = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
      inner.style.transform = `translate(${(x * 5).toFixed(2)}px, ${(y * 5).toFixed(2)}px)`;
    };

    const reset = () => {
      if (innerRef.current) innerRef.current.style.transform = "none";
    };

    return (
      <button
        ref={setRefs}
        onPointerMove={handleMove}
        onPointerLeave={reset}
        className={cn(
          "sheen relative inline-flex select-none items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold leading-none transition-[background,color,border-color,transform] duration-200 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-55",
          block && "w-full",
          VARIANTS[variant],
          className
        )}
        {...rest}
      >
        <span
          ref={innerRef}
          className="inline-flex items-center gap-2 transition-transform duration-200 ease-out"
        >
          {children as ReactNode}
        </span>
      </button>
    );
  }
);
