"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Brand logo with a permanent pixel-art fallback underneath: the drawn
 * fallback is always rendered, and the raster logo is layered on top only
 * after it successfully loads. A missing file never shows a broken image.
 *
 * Drop the real files at the paths below:
 *   frontend/public/brand/pothole-reporter.png   (main website)
 *   tender-website/public/brand/tendering.png    (tender website)
 */
export default function BrandLogo({
  src,
  alt,
  size = 36,
  fallback,
}: {
  src: string;
  alt: string;
  size?: number;
  fallback: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    // Cached images may finish before React attaches onLoad; resolve here.
    if (img.complete) setLoaded(img.naturalWidth > 0);
  }, [src]);

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden"
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 flex items-center justify-center">
        {fallback}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        width={size}
        height={size}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
        className="relative select-none object-contain"
        style={{
          width: size,
          height: size,
          opacity: loaded ? 1 : 0,
        }}
        aria-hidden={loaded ? undefined : true}
      />
    </span>
  );
}
