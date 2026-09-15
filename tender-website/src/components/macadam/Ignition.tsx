"use client";

import { Children, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface IgnitionProps {
  children: ReactNode;
  className?: string;
  /** ms between successive children */
  step?: number;
  /** ms before the first child */
  delay?: number;
}

/**
 * The one authored entrance: each direct child masks/fades up in sequence.
 * Collapses to an instant reveal under `prefers-reduced-motion`.
 */
export function Ignition({ children, className, step = 90, delay = 0 }: IgnitionProps) {
  return (
    <div className={className}>
      {Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;
        const el = child as ReactElement<{ className?: string; style?: CSSProperties }>;
        return cloneElement(el, {
          className: cn(el.props.className, "ignite"),
          style: {
            ...el.props.style,
            ["--ignite-delay" as string]: `${delay + index * step}ms`,
          } as CSSProperties,
        });
      })}
    </div>
  );
}
