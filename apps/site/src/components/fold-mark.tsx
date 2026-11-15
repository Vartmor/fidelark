import { motion, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";

// Master geometry from branding/assets/logo/svg (120 x 120). Do not redraw or adjust.
const LEFT = "M24 86 V25 H86 L73 41 H41 V73 Z";
const RIGHT = "M96 34 V95 H34 L47 79 H79 V47 Z";

type Props = {
  className?: string;
  /** Display artwork splits the mark: mint upper-left, signal lower-right (brandbook §02). */
  split?: boolean;
  /** Halves slide in from opposite corners and meet: the transfer motif. */
  animate?: boolean;
  delay?: number;
};

export function FoldMark({ className, split = true, animate = false, delay = 0 }: Props) {
  const reduce = useReducedMotion();
  const run = animate && !reduce;
  const half = (from: { x: number; y: number }) =>
    run
      ? {
          initial: { opacity: 0, x: from.x, y: from.y },
          animate: { opacity: 1, x: 0, y: 0 },
          transition: { duration: 1.4, delay, ease: EASE_OUT },
        }
      : {};
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      <motion.path
        d={LEFT}
        fill={split ? "var(--f-mint)" : "currentColor"}
        fillRule="evenodd"
        {...half({ x: -14, y: -14 })}
      />
      <motion.path
        d={RIGHT}
        fill={split ? "var(--f-signal)" : "currentColor"}
        fillRule="evenodd"
        {...half({ x: 14, y: 14 })}
      />
    </svg>
  );
}
