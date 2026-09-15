import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface NavBarProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

/** Sticky, opaque app bar. Opaque on purpose: no glass, just a hairline. */
export function NavBar({ className, children, ...rest }: NavBarProps) {
  return (
    <header
      className={cn("sticky top-0 z-40 border-b border-hairline bg-page", className)}
      {...rest}
    >
      {children}
    </header>
  );
}

export interface NavInnerProps extends HTMLAttributes<HTMLDivElement> {
  width?: "default" | "wide" | "full";
}

export function NavInner({ className, width = "wide", children, ...rest }: NavInnerProps) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-[64px] items-center gap-3 px-4 sm:px-6",
        width === "default" && "max-w-5xl",
        width === "wide" && "max-w-7xl",
        width === "full" && "max-w-none",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function NavSpacer() {
  return <span className="flex-1" />;
}
