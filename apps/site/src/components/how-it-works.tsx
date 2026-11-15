import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import { Command } from "@/components/ui/command";
import { MaskedTextReveal } from "@/components/ui/text-reveal-mask";
import { reveal } from "@/lib/motion";

const STEPS = [
  {
    verb: "Inspect",
    text: "Reads the file without running it and lists every dependency, permission and risk, each with its line.",
    command: "fidelark inspect artifact.html",
  },
  {
    verb: "Convert",
    text: "Packs local files, and remote ones if you allow it, into one HTML file with a manifest of everything inside.",
    command: "fidelark convert artifact.html --allow-network",
  },
  {
    verb: "Verify",
    text: "Opens the result in a sandboxed browser with the network cut, then reports what it tried to load and what broke.",
    command: "fidelark verify artifact.fidelark.html",
  },
] as const;

// Matches lg:gap-10 on the list and the staircase step in each item's padding.
const GAP = 40;
const STEP = 126;
const FIRST_Y = 24;

/**
 * The brand's 90-degree trace route through the three stations. Each drop runs down the middle
 * of a column gap, so the line never crosses the copy at any width.
 */
function tracePath(width: number) {
  const col = (width - GAP * 2) / 3;
  const drop1 = col + GAP / 2;
  const drop2 = col * 2 + GAP * 1.5;
  const y = (i: number) => FIRST_Y + i * STEP;
  return `M 0 ${y(0)} H ${drop1} V ${y(1)} H ${drop2} V ${y(2)} H ${width}`;
}

export function HowItWorks() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [width, setWidth] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const draw = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  const path = width > 0 ? tracePath(width) : "";
  const height = FIRST_Y + STEP * 2 + 4;

  return (
    <section
      ref={ref}
      id="how"
      aria-labelledby="how-title"
      className="relative scroll-mt-16 py-[clamp(4.5rem,12vh,9rem)]"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <MaskedTextReveal
          id="how-title"
          as="h2"
          className="display max-w-[46rem] text-[clamp(2.25rem,1.2rem+3vw,4rem)] text-ink"
        >
          Three commands. Nothing hidden.
        </MaskedTextReveal>

        <div className="relative mt-14 lg:mt-20">
          {/* Trace path, drawn as the section scrolls by (desktop). */}
          {path && (
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width={width}
              height={height}
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 hidden overflow-visible lg:block"
            >
              <path d={path} fill="none" stroke="var(--f-line)" strokeWidth="2" />
              <motion.path
                d={path}
                fill="none"
                stroke="var(--f-signal)"
                strokeWidth="2"
                style={{ pathLength: reduce ? 1 : draw }}
              />
            </svg>
          )}

          <ol
            ref={listRef}
            className="relative grid gap-12 border-l border-line pl-6 lg:grid-cols-3 lg:gap-10 lg:border-l-0 lg:pl-0"
          >
            {STEPS.map((step, i) => (
              <motion.li
                key={step.verb}
                className="relative lg:pt-[calc(var(--step)*126px+56px)]"
                style={{ "--step": i } as React.CSSProperties}
                {...reveal(reduce, i * 0.08)}
              >
                <span
                  aria-hidden="true"
                  className="absolute top-2 -left-[calc(1.5rem+5px)] size-[9px] rounded-[2px] bg-mint-deep lg:top-[calc(var(--step)*126px+20px)] lg:left-0"
                />
                <h3 className="text-[1.75rem] font-semibold tracking-[-0.035em] text-ink">
                  {step.verb}
                </h3>
                <p className="mt-3 max-w-[24rem] text-[1rem] leading-[1.6] text-slate">
                  {step.text}
                </p>
                <Command className="mt-5 max-w-[26rem]">{step.command}</Command>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
