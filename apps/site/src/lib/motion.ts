import type { TargetAndTransition, Transition } from "framer-motion";

/** One easing for every entrance on the page (expo out). */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export type AppearKind = "scale" | "soft" | "mask" | "pop" | "btn" | "side" | "stat";

const FROM: Record<AppearKind, TargetAndTransition> = {
  scale: { opacity: 0, scale: 0.84 },
  soft: { opacity: 0, y: 14 },
  mask: { opacity: 0, y: "40%" },
  pop: { opacity: 0, scale: 0.9 },
  btn: { opacity: 0, y: 18, scale: 0.94 },
  side: { opacity: 0, x: 22 },
  stat: { opacity: 0, y: 20 },
};

const TO: Record<AppearKind, TargetAndTransition> = {
  scale: { opacity: 1, scale: 1 },
  soft: { opacity: 1, y: 0 },
  mask: { opacity: 1, y: "0%" },
  pop: { opacity: 1, scale: [0.9, 1.03, 1] },
  btn: { opacity: 1, y: 0, scale: 1 },
  side: { opacity: 1, x: 0 },
  stat: { opacity: 1, y: 0 },
};

/**
 * Props for one element of the hero entrance sequence. The delays set reading order:
 * logo, navigation, headline, lede, actions, facts. Returns nothing with reduced motion.
 */
export function appear(kind: AppearKind, delay: number, reduce: boolean | null, duration = 1.05) {
  if (reduce) return {};
  const transition: Transition = { duration, delay, ease: EASE_OUT };
  if (kind === "pop") transition.times = [0, 0.7, 1];
  return { initial: FROM[kind], animate: TO[kind], transition };
}

/** Scroll reveal for content below the hero: enters once, 30% into view. */
export function reveal(reduce: boolean | null, delay = 0) {
  if (reduce) return {};
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.7, delay, ease: EASE_OUT },
  };
}
