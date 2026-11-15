import { m, useReducedMotion } from "framer-motion";
import { HardDrive, ShieldCheck } from "lucide-react";
import { FoldMark } from "@/components/fold-mark";
import { MaskedTextReveal } from "@/components/ui/text-reveal-mask";
import { reveal } from "@/lib/motion";
import { FIDELITY } from "@/lib/site";
import gateFieldDark from "../../../../branding/assets/patterns/gate-field-dark.svg";

const AXES = [
  { axis: "content", grade: "exact-portable" },
  { axis: "visual", grade: "exact-portable" },
  { axis: "behavioral", grade: "connected" },
] as const;

const glyphOf = (id: string) => FIDELITY.find((f) => f.id === id);

/** The page's one deliberate color block: the audit surface, in brand ink. */
export function Principles() {
  const reduce = useReducedMotion();
  const cell = "relative overflow-hidden rounded-[24px] p-7 sm:p-9";
  return (
    <section
      id="principles"
      aria-labelledby="principles-title"
      className="scroll-mt-16 bg-ink-deep py-[clamp(4.5rem,12vh,9rem)] text-paper"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <MaskedTextReveal
          id="principles-title"
          as="h2"
          className="display max-w-[46rem] text-[clamp(2.25rem,1.2rem+3vw,4rem)] text-paper"
        >
          Built for files you did not write.
        </MaskedTextReveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-6">
          <m.article className={`${cell} bg-surface-dark lg:col-span-4`} {...reveal(reduce)}>
            <img
              src={gateFieldDark}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 h-full w-2/3 object-cover opacity-50 [mask-image:linear-gradient(90deg,transparent,#000_60%)]"
            />
            <div className="relative max-w-[26rem]">
              <HardDrive aria-hidden="true" className="size-6 text-mint" strokeWidth={1.75} />
              <h3 className="mt-5 text-[1.5rem] font-semibold tracking-[-0.03em]">Local-first</h3>
              <p className="mt-3 leading-[1.6] text-slate-dark">
                Everything runs on your machine. No uploads, no account, no telemetry. Remote files
                are fetched only when you allow it, and only from public addresses.
              </p>
            </div>
          </m.article>

          <m.article
            className={`${cell} border border-surface-dark bg-ink lg:col-span-2`}
            {...reveal(reduce, 0.06)}
          >
            <ShieldCheck aria-hidden="true" className="size-6 text-signal" strokeWidth={1.75} />
            <h3 className="mt-5 text-[1.5rem] font-semibold tracking-[-0.03em]">Safe by default</h3>
            <p className="mt-3 leading-[1.6] text-slate-dark">
              Inspection never executes the file. Verification runs it in a sandbox with the network
              cut.
            </p>
          </m.article>

          <m.article className={`${cell} bg-mint text-ink lg:col-span-2`} {...reveal(reduce, 0.12)}>
            <h3 className="text-[1.5rem] font-semibold tracking-[-0.03em]">Honest portability</h3>
            <p className="mt-3 leading-[1.6] text-ink/80">
              Three axes, each with its own class and the line that decided it.
            </p>
            <ul className="mt-6 flex flex-col gap-2">
              {AXES.map(({ axis, grade }) => {
                const f = glyphOf(grade);
                return (
                  <li
                    key={axis}
                    className="flex items-center justify-between gap-3 rounded-[10px] bg-white/70 px-3 py-2"
                  >
                    <span className="font-mono text-[0.8125rem] text-ink">{axis}</span>
                    <span className="chip" data-grade={grade}>
                      <span aria-hidden="true">{f?.glyph}</span>
                      {f?.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </m.article>

          <m.article
            className={`${cell} border border-surface-dark bg-ink lg:col-span-4`}
            {...reveal(reduce, 0.18)}
          >
            <FoldMark
              split={false}
              className="absolute -right-10 -bottom-10 size-56 text-surface-dark"
            />
            <div className="relative">
              <h3 className="text-[1.5rem] font-semibold tracking-[-0.03em]">Deterministic</h3>
              <p className="mt-3 max-w-[30rem] leading-[1.6] text-slate-dark">
                The same file always gives the same report. No model guesses what your file does,
                and every export records what it embedded.
              </p>
              <pre className="mt-6 overflow-x-auto rounded-[14px] border border-surface-dark bg-ink-deep p-4 font-mono text-[0.75rem] leading-[1.6] text-mint">
                {`<script type="application/json" id="fidelark-export">
{ "bundled": [{ "kind": "script", "from": "remote",
    "mediaType": "text/javascript", "sha256": "…" }],
  "skipped": [{ "kind": "network", "failed": false }] }`}
              </pre>
            </div>
          </m.article>
        </div>
      </div>
    </section>
  );
}
