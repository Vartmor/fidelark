import { motion, useReducedMotion } from "framer-motion";
import { siGithub } from "simple-icons";
import { FoldMark } from "@/components/fold-mark";
import { ActionLink } from "@/components/ui/action-link";
import { Command } from "@/components/ui/command";
import { MaskedTextReveal } from "@/components/ui/text-reveal-mask";
import { reveal } from "@/lib/motion";
import { CLI_URL, REPO_URL, SECURITY_URL, SHARE_URL, TRADEMARKS_URL } from "@/lib/site";
import lockupInk from "../../../../branding/assets/logo/svg/lockup-ink.svg";

export function Closing() {
  const reduce = useReducedMotion();
  return (
    <section
      id="start"
      aria-labelledby="start-title"
      className="relative isolate scroll-mt-16 overflow-hidden border-t border-line"
    >
      <FoldMark className="absolute -z-10 -bottom-[18%] -left-[10%] hidden size-[min(70vw,560px)] opacity-25 lg:block" />
      <div className="mx-auto grid max-w-[1440px] items-end gap-12 px-4 py-[clamp(4.5rem,14vh,10rem)] sm:px-6 lg:grid-cols-[7fr_5fr] lg:px-10">
        <div>
          <MaskedTextReveal
            id="start-title"
            as="h2"
            className="display text-[clamp(2.5rem,1.2rem+4vw,5rem)] text-ink"
          >
            Bring an artifact that broke.
          </MaskedTextReveal>
          <p className="mt-5 max-w-[34rem] text-[1.0625rem] leading-[1.6] text-slate">
            Saved something from an AI chat that stopped working? Share it. With your permission,
            real cases become test fixtures.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 max-[420px]:flex-col max-[420px]:items-stretch">
            <ActionLink href={SHARE_URL} className="[--btn-h:3rem]">
              Share an artifact
            </ActionLink>
            <ActionLink href={CLI_URL} variant="glass" className="[--btn-h:3rem]">
              Get the CLI
            </ActionLink>
          </div>
        </div>

        <motion.div
          className="rounded-[24px] border border-line bg-white/70 p-6 backdrop-blur-md sm:p-8"
          {...reveal(reduce, 0.1)}
        >
          <h3 className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink">
            Try it on your own file
          </h3>
          <p className="mt-2 text-[0.9375rem] leading-[1.55] text-slate">
            Needs Node.js 24 and pnpm. Nothing leaves your machine.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Command>{`git clone ${REPO_URL}`}</Command>
            <Command>pnpm install</Command>
            <Command>pnpm fidelark inspect path/to/artifact.html</Command>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const links = [
    { label: "Security", href: SECURITY_URL },
    { label: "Trademarks", href: TRADEMARKS_URL },
  ];
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-10 text-[0.875rem] text-slate sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div className="flex flex-col gap-3">
          <img
            src={lockupInk}
            alt="Fidelark"
            width={101}
            height={29}
            className="h-6 w-auto self-start"
          />
          <p>
            Code under Apache-2.0. Fidelark is a working name. This page sets no cookies and runs no
            analytics.
          </p>
        </div>
        <nav aria-label="Footer" className="flex items-center gap-5">
          <a
            href={REPO_URL}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 py-1.5 text-ink hover:text-signal-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-signal-deep"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
              <path d={siGithub.path} />
            </svg>
            GitHub
          </a>
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              rel="noopener noreferrer"
              className="py-1.5 hover:text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-signal-deep"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
