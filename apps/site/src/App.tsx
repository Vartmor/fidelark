import { domAnimation, LazyMotion } from "framer-motion";
import { Closing, SiteFooter } from "@/components/closing";
import { FidelityScale } from "@/components/fidelity-scale";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Principles } from "@/components/principles";
import { ScannerBelt } from "@/components/scanner/scanner-belt";
import { SiteHeader } from "@/components/site-header";
import { Status } from "@/components/status";

/**
 * Components use the light `m.*` elements; animation features load once here. domAnimation covers
 * everything the page uses (animate, exit, whileInView, hover/tap). Drag or layout animations would
 * need domMax. `strict` throws if a full `motion.*` element slips back in.
 */
export function App() {
  return (
    <LazyMotion features={domAnimation} strict>
      <a
        href="#main"
        className="sr-only z-[90] rounded-[10px] bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="grain" aria-hidden="true" />
      <SiteHeader />
      <main id="main">
        <Hero />
        <ScannerBelt />
        <HowItWorks />
        <FidelityScale />
        <Principles />
        <Status />
        <Closing />
      </main>
      <SiteFooter />
    </LazyMotion>
  );
}
