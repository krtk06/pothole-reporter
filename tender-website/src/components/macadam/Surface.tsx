import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** depth level: 0 flat, 1 resting, 2 raised, 3 overlay */
  level?: 0 | 1 | 2 | 3;
  /** inset wells (inputs, table bodies) instead of raised cards */
  inset?: boolean;
  padded?: boolean;
  grain?: boolean;
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  { className, level = 1, inset = false, padded = true, grain = false, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative isolate rounded-xl border border-hairline",
        inset ? "bg-sunken" : "bg-surface",
        level === 1 && "shadow-1",
        level === 2 && "shadow-2",
        level === 3 && "shadow-3",
        padded && "p-5 sm:p-6",
        grain && "grain overflow-hidden",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
