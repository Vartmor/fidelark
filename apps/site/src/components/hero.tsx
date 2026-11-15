import { motion, useReducedMotion } from "framer-motion";
import { HardDrive, ListChecks, ShieldCheck } from "lucide-react";
import { FoldMark } from "@/components/fold-mark";
import { ActionLink } from "@/components/ui/action-link";
import { appear } from "@/lib/motion";
import { CLI_URL } from "@/lib/site";
import gateField from "../../../../branding/assets/patterns/gate-field-light.svg";

const FACTS = [
  { icon: HardDrive, text: "Runs on your machine and sends nothing" },
  { icon: ListChecks, text: "Six named outcomes, never a score" },
  { icon: ShieldCheck, text: "Checked offline in a sandboxed browser" },
] as const;

export function Hero() {
  const reduce = useReducedMotion();
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate grid min-h-[100dvh] grid-rows-[1fr_auto] overflow-hidden pt-16"
    >
      <div id="top-sentinel" aria-hidden="true" className="absolute top-0 h-px w-px" />

      {/* Brand pattern, faded toward the copy so text always sits on plain paper. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 opacity-60 [mask-image:radial-gradient(ellipse_70%_80%_at_85%_40%,#000_10%,transparent_70%)]"
        style={{ backgroundImage: `url(${gateField})`, backgroundSize: "720px auto" }}
      />
      {/* Monumental split Open Fold: mint upper-left, signal lower-right (brandbook display use). */}
      <FoldMark
        animate
        delay={0.2}
        className="absolute -z-10 top-[14%] right-[-14vw] hidden size-[min(78vh,74vw)] opacity-90 sm:block lg:top-1/2 lg:right-[-3vw] lg:size-[min(80vh,46vw)] lg:-translate-y-1/2"
      />

      <div className="mx-auto flex w-full max-w-[1440px] items-end px-4 pb-[clamp(2rem,7vh,5.5rem)] sm:px-6 lg:px-10">
        <div className="relative max-w-[54rem]">
          {/* Phones: the mark hangs off the right edge, tied to the copy so it never sits under text. */}
          <FoldMark
            animate
            delay={0.2}
            className="absolute -top-[30vw] right-[-26vw] -z-10 size-[62vw] sm:hidden"
          />
          <motion.p
            className="mb-6 inline-flex items-center gap-2 rounded-[10px] border border-border-strong/40 bg-white/65 px-3 py-2 text-[0.8125rem] font-medium tracking-[-0.01em] text-ink backdrop-blur-md"
            {...appear("pop", 0.22, reduce, 0.9)}
          >
            <FoldMark split={false} className="size-4 text-ink" />
            Open-source CLI for AI artifacts
          </motion.p>

          <h1
            id="hero-title"
            className="display text-[min(clamp(3rem,1.2rem+5vw,6rem),13.5vh)] text-ink"
          >
            {["Your work.", "Beyond the chat."].map((line, i) => (
              <span key={line} className="block overflow-hidden pb-[0.06em]">
                <motion.span
                  className={i === 1 ? "block text-slate" : "block"}
                  {...appear("mask", 0.42 + i * 0.2, reduce)}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            className="mt-6 max-w-[34rem] text-[clamp(1.0625rem,0.95rem+0.35vw,1.25rem)] leading-[1.55] tracking-[-0.015em] text-slate"
            {...appear("soft", 0.82, reduce, 1.25)}
          >
            Fidelark inspects pages made by AI, packs what they depend on, and checks they still
            open offline.
          </motion.p>

          <div className="mt-8 flex flex-wrap items-center gap-3 max-[420px]:flex-col max-[420px]:items-stretch">
            <ActionLink
              href={CLI_URL}
              className="[--btn-h:3rem]"
              entrance={{ kind: "btn", delay: 0.96 }}
            >
              Get the CLI
            </ActionLink>
            <ActionLink
              href="#survives"
              variant="glass"
              className="[--btn-h:3rem]"
              entrance={{ kind: "side", delay: 1.1 }}
            >
              See what survives
            </ActionLink>
          </div>
        </div>
      </div>

      <ul className="mx-auto grid w-full max-w-[1440px] gap-4 border-t border-line px-4 py-5 sm:grid-cols-3 sm:gap-6 sm:px-6 lg:px-10">
        {FACTS.map(({ icon: Icon, text }, i) => (
          <motion.li
            key={text}
            className="flex items-center gap-3 text-[0.9375rem] tracking-[-0.015em] text-ink/85"
            {...appear("stat", 1.12 + i * 0.16, reduce)}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ink text-mint">
              <Icon aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.75} />
            </span>
            {text}
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
