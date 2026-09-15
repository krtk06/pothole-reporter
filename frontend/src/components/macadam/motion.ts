/**
 * MACADAM motion vocabulary — shared by both portals.
 *
 * One language: micro/control/surface/reveal durations, two easings, and a
 * small set of springs. Components import from here so the two worlds move
 * identically.
 */

export const durations = {
  micro: 0.12,
  control: 0.2,
  surface: 0.32,
  reveal: 0.56,
} as const;

export const easeOut = [0.2, 0.8, 0.2, 1] as [number, number, number, number];
export const easeInOut = [0.65, 0, 0.35, 1] as [number, number, number, number];

export const springSoft = {
  type: "spring" as const,
  stiffness: 220,
  damping: 26,
  mass: 0.9,
};

export const springSnappy = {
  type: "spring" as const,
  stiffness: 360,
  damping: 30,
  mass: 0.8,
};

export const magneticSpring = { stiffness: 220, damping: 18, mass: 0.6 };

export const stagger = { tight: 0.04, normal: 0.07, loose: 0.12 } as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.reveal, ease: easeOut },
  },
};

export function fadeUpGroup(staggerChildren = stagger.normal, delayChildren = 0) {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
