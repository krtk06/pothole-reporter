"use client";

import { useEffect, useState } from "react";
import { rowsToPath } from "./PixelIcon";

/* 16x16 multi-frame sprites, hand-authored. */

const WORKER_A = [
  "................",
  ".....####.......",
  "....#....#......",
  "....#.##.#......",
  "....#....#......",
  ".....####.......",
  "....######......",
  "...#..##..#.....",
  "...#..##..#.....",
  "...#..##..#.....",
  ".....##.........",
  ".....##.........",
  "....##.##.......",
  "...##...##......",
  "...##...##......",
  "................",
];

const WORKER_B = [
  "................",
  ".....####.......",
  "....#....#......",
  "....#.##.#......",
  "....#....#......",
  ".....####.......",
  "....######......",
  "...#..##..#.....",
  "...#..##..#.....",
  "...#..##..#.....",
  ".....##.........",
  ".....###........",
  "....##.##.......",
  "....##.##.......",
  "...##...##......",
  "................",
];

const ROAD_A = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

export const PIXEL_SPRITES: Record<string, string[][]> = {
  worker: [WORKER_A, WORKER_B],
  road: [ROAD_A],
};

export default function PixelSprite({
  name,
  size = 48,
  className = "",
  fps = 2,
  alt = "",
}: {
  name: keyof typeof PIXEL_SPRITES | string;
  size?: number;
  className?: string;
  fps?: number;
  alt?: string;
}) {
  const frames = PIXEL_SPRITES[name] ?? [];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (frames.length < 2) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(
      () => setFrame((f) => (f + 1) % frames.length),
      1000 / fps
    );
    return () => window.clearInterval(id);
  }, [frames.length, fps]);

  if (!frames.length) return null;

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      shapeRendering="crispEdges"
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <path d={rowsToPath(frames[frame])} />
    </svg>
  );
}
