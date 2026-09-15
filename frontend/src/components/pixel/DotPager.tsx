"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface DotPage {
  id: string;
  label: string;
}

interface DotPagerProps {
  pages: DotPage[];
  initial?: number;
  active?: number;
  onChange?: (index: number) => void;
  children: ReactNode;
  disabled?: boolean[];
  syncHash?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Fixed-viewport paged shell. Pages slide with a chunky steps() motion;
 * navigation lives on a pixel dot rail (keyboard + click + swipe).
 * The page itself never scrolls; panels own any internal overflow.
 */
export default function DotPager({
  pages,
  initial = 0,
  active: controlled,
  onChange,
  children,
  disabled = [],
  syncHash = true,
  ariaLabel = "Sections",
  className = "",
}: DotPagerProps) {
  const count = pages.length;
  const [internal, setInternal] = useState(() => {
    if (syncHash && typeof window !== "undefined") {
      const i = pages.findIndex((p) => `#${p.id}` === window.location.hash);
      if (i >= 0) return i;
    }
    return Math.min(Math.max(initial, 0), Math.max(count - 1, 0));
  });
  const active = controlled ?? internal;

  const panelRefs = useRef<(HTMLElement | null)[]>([]);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (i: number) => {
      if (i < 0 || i >= count || disabled[i]) return;
      if (controlled === undefined) setInternal(i);
      onChange?.(i);
      if (syncHash && typeof window !== "undefined") {
        const id = pages[i]?.id;
        if (id && window.location.hash !== `#${id}`) {
          window.history.replaceState(null, "", `#${id}`);
        }
      }
    },
    [count, controlled, disabled, onChange, pages, syncHash]
  );

  useEffect(() => {
    panelRefs.current.forEach((el, i) => {
      if (!el) return;
      if (i === active) el.removeAttribute("inert");
      else el.setAttribute("inert", "");
    });
  }, [active, count]);

  useEffect(() => {
    if (!syncHash) return;
    const onHash = () => {
      const i = pages.findIndex((p) => `#${p.id}` === window.location.hash);
      if (i >= 0 && controlled === undefined) setInternal(i);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [pages, controlled, syncHash]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      go(active + 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      go(active - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(count - 1);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 50) return;
    go(dx < 0 ? active + 1 : active - 1);
  };

  const kids = Array.isArray(children) ? children : [children];

  return (
    <div
      className={`relative h-full min-h-0 w-full overflow-hidden ${className}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex h-full w-full"
        style={{
          transform: `translate3d(-${active * 100}%, 0, 0)`,
          transition: "transform 260ms steps(6, end)",
        }}
      >
        {kids.map((child, i) => (
          <section
            key={pages[i]?.id ?? i}
            id={pages[i]?.id}
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            role="tabpanel"
            aria-label={pages[i]?.label}
            aria-hidden={i !== active}
            className="h-full w-full shrink-0 overflow-hidden"
          >
            {child}
          </section>
        ))}
      </div>

      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="vertical"
        onKeyDown={onKey}
        className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 flex-row gap-3 lg:bottom-auto lg:left-auto lg:right-4 lg:top-1/2 lg:flex-col lg:-translate-y-1/2 lg:translate-x-0"
      >
        {pages.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls={p.id}
            aria-label={p.label}
            title={p.label}
            data-active={i === active}
            disabled={disabled[i]}
            onClick={() => go(i)}
            className="px-dot disabled:opacity-30"
          />
        ))}
      </div>
    </div>
  );
}
