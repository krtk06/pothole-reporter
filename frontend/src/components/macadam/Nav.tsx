"use client";

import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface NavBarProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

/**
 * Sticky app bar. Transparent over the hero; once scrolled it settles into a
 * solid surface with a hairline and a slight blur. Structure unchanged.
 */
export function NavBar({ className, children, ...rest }: NavBarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled}
      className={cn(
        "sticky top-0 z-40 transition-[background-color,border-color] duration-300",
        scrolled
          ? "border-b border-hairline bg-page/95 backdrop-blur-sm"
          : "border-b border-transparent bg-transparent",
        className
      )}
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
