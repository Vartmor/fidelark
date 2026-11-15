import { motion, useReducedMotion } from "framer-motion";
import { Check, CircleDashed } from "lucide-react";
import { MaskedTextReveal } from "@/components/ui/text-reveal-mask";
import { reveal } from "@/lib/motion";
import { ROADMAP_URL } from "@/lib/site";

const TODAY = [
  "Inspect single HTML files without running them",
  "Convert them into one self-contained HTML file",
  "Verify the result offline in a sandboxed browser",
  "Apache-2.0 open core with a regression test corpus",
];

const NEXT = [
  "Turn React/JSX artifact source into runnable offline HTML",
  "Bundle ES module graphs",
  "Inspect ZIP exports",
  "Preview files in a local sandbox",
];

export function Status() {
  const reduce = useReducedMotion();
  return (
    <section
      id="status"
      aria-labelledby="status-title"
      className="scroll-mt-16 py-[clamp(4.5rem,12vh,9rem)]"
    >
      <div className="mx-auto grid max-w-[1440px] gap-12 px-4 sm:px-6 lg:grid-cols-[5fr_7fr] lg:px-10">
        <div>
          <MaskedTextReveal
            id="status-title"
            as="h2"
            className="display text-[clamp(2.25rem,1.2rem+3vw,4rem)] text-ink"
          >
            Pre-alpha. Built in the open.
          </MaskedTextReveal>
          <p className="mt-4 max-w-[30rem] text-[1.0625rem] leading-[1.6] text-slate">
            Fidelark is under active development. The CLI works today, and the report format can
            still change.
          </p>
          <a
            href={ROADMAP_URL}
            rel="noopener noreferrer"
            className="mt-5 inline-flex py-1 text-[0.9375rem] font-medium text-signal-deep underline decoration-signal-deep/40 underline-offset-4 transition-colors hover:decoration-signal-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-signal-deep"
          >
            Read the roadmap on GitHub
          </a>
        </div>

        <div className="grid gap-10 sm:grid-cols-2">
          {[
            { title: "Works today", items: TODAY, done: true },
            { title: "Next", items: NEXT, done: false },
          ].map((group, g) => (
            <motion.div key={group.title} {...reveal(reduce, g * 0.08)}>
              <h3 className="border-b border-ink/80 pb-3 text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink">
                {group.title}
              </h3>
              <ul className="mt-4 flex flex-col gap-4">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-3 text-[0.9375rem] leading-[1.5] text-ink/85">
                    {group.done ? (
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 size-[1.125rem] shrink-0 text-mint-deep"
                        strokeWidth={2}
                      />
                    ) : (
                      <CircleDashed
                        aria-hidden="true"
                        className="mt-0.5 size-[1.125rem] shrink-0 text-slate"
                        strokeWidth={1.75}
                      />
                    )}
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
