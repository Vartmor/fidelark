import { motion, useReducedMotion } from "framer-motion";
import { MaskedTextReveal } from "@/components/ui/text-reveal-mask";
import reports from "@/data/reports.json";
import { EASE_OUT } from "@/lib/motion";
import { FIDELITY, FIXTURE_NAMES } from "@/lib/site";

/** Fixtures that land in each class, straight from the generated reports. */
function examplesFor(fidelity: string) {
  return reports.filter((r) => r.fidelity === fidelity).map((r) => FIXTURE_NAMES[r.id] ?? r.title);
}

export function FidelityScale() {
  const reduce = useReducedMotion();
  return (
    <section
      id="fidelity"
      aria-labelledby="fidelity-title"
      className="scroll-mt-16 bg-white/55 py-[clamp(4.5rem,12vh,9rem)]"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <MaskedTextReveal
          id="fidelity-title"
          as="h2"
          className="display max-w-[46rem] text-[clamp(2.25rem,1.2rem+3vw,4rem)] text-ink"
        >
          Six outcomes. Each one named.
        </MaskedTextReveal>
        <p className="mt-4 max-w-[38rem] text-[1.0625rem] leading-[1.6] text-slate">
          Content, visual and behavioral fidelity are reported separately, each with the evidence
          that decided it. Never a percentage.
        </p>

        <div className="mt-14">
          <div
            aria-hidden="true"
            className="mb-4 hidden items-center justify-between font-mono text-[0.75rem] text-slate lg:flex"
          >
            <span>More portable</span>
            <span className="mx-4 h-px flex-1 bg-[linear-gradient(90deg,var(--f-mint),var(--f-line)_50%,var(--f-signal))]" />
            <span>Less portable</span>
          </div>
          <ol className="grid border-t border-ink/80 lg:grid-cols-6">
            {FIDELITY.map((f, i) => {
              const examples = examplesFor(f.id);
              return (
                <motion.li
                  key={f.id}
                  className="group relative flex flex-col gap-3 border-b border-line py-6 transition-colors duration-200 hover:bg-white lg:border-b-0 lg:border-l lg:px-5 lg:first:border-l-0 lg:first:pl-0"
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease: EASE_OUT }}
                >
                  <span className="chip w-fit" data-grade={f.id}>
                    <span aria-hidden="true">{f.glyph}</span>
                    {f.label}
                  </span>
                  <p className="text-[0.9375rem] leading-[1.55] text-ink/85">{f.description}</p>
                  <p className="mt-auto pt-2 text-[0.8125rem] leading-[1.5] text-slate">
                    {examples.length > 0
                      ? `In our fixtures: ${examples.join(", ")}`
                      : "No fixture lands here yet"}
                  </p>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
