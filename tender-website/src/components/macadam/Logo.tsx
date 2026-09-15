import { cn } from "@/lib/utils";

export interface LogoProps {
  src: string;
  name: string;
  tagline?: string;
  size?: number;
  className?: string;
}

/** Adaptive brand mark: the supplied emblem plus a wordmark. */
export function Logo({ src, name, tagline, size = 34, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
        draggable={false}
      />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[15px] font-bold tracking-[-0.01em] text-ink">{name}</span>
        {tagline && (
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink3">
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
