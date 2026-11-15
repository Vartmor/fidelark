/**
 * Site header: logo, centered navigation pills, call to action, full-screen menu on small screens.
 * The morphing pill and section tracking are adapted from the 21st.dev component
 * "Floating Glassmorphic Navbar with Morphing Pill Indicator" by themeocean
 * (https://21st.dev/@themeocean); its scroll listener was replaced with IntersectionObservers.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { ActionLink } from "@/components/ui/action-link";
import { appear, EASE_OUT } from "@/lib/motion";
import { CLI_URL, NAV_ITEMS } from "@/lib/site";
import { cn } from "@/lib/utils";
import lockupInk from "../../../../branding/assets/logo/svg/lockup-ink.svg";

const SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;
const NAV_KINDS = ["scale", "soft", "scale", "soft"] as const;

export function SiteHeader() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const pillId = useId();
  const menuId = useId();

  // Frosted background once the top of the page has scrolled away.
  useEffect(() => {
    const sentinel = document.getElementById("top-sentinel");
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry?.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Highlight the section in the middle band of the screen.
  useEffect(() => {
    const sections = NAV_ITEMS.map((item) => document.getElementById(item.href.slice(1))).filter(
      (el): el is HTMLElement => el !== null,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = `#${entry.target.id}`;
          if (entry.isIntersecting) setActive(id);
          else setActive((current) => (current === id ? null : current));
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Full-screen menu: Escape closes, a wide screen closes, page scroll is locked while open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    firstLinkRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = (e: MediaQueryListEvent) => e.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  const highlighted = hovered ?? active;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled && !open
          ? "border-b border-line/80 bg-paper/80 backdrop-blur-xl backdrop-saturate-150"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[1fr_auto_auto] items-center gap-2 px-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:px-10">
        <motion.a
          href="#top"
          aria-label="Fidelark home"
          className="relative z-[80] justify-self-start rounded-[10px] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal-deep"
          {...appear("scale", 0.08, reduce)}
        >
          <img src={lockupInk} alt="" width={101} height={29} className="h-7 w-auto" />
        </motion.a>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1 rounded-[12px] border border-border-strong/30 bg-white/55 p-1 shadow-[inset_0_1px_0_#fff] backdrop-blur-md">
            {NAV_ITEMS.map((item, i) => {
              const isOn = highlighted === item.href;
              return (
                <motion.li
                  key={item.href}
                  {...appear(NAV_KINDS[i] ?? "soft", 0.16 + i * 0.12, reduce)}
                >
                  <a
                    href={item.href}
                    aria-current={active === item.href ? "location" : undefined}
                    onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(item.href)}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(item.href)}
                    onBlur={() => setHovered(null)}
                    className={cn(
                      "relative isolate flex h-9 items-center rounded-[10px] px-4 text-[0.875rem] font-medium tracking-[-0.01em] whitespace-nowrap transition-colors duration-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-signal-deep",
                      isOn ? "text-paper" : "text-ink/80 hover:text-ink",
                    )}
                  >
                    {isOn && (
                      <motion.span
                        layoutId={`pill-${pillId}`}
                        aria-hidden="true"
                        transition={reduce ? { duration: 0 } : SPRING}
                        className="absolute inset-0 -z-10 rounded-[10px] bg-ink shadow-[inset_0_1px_0_rgb(246_243_236/0.2)]"
                      />
                    )}
                    {item.label}
                  </a>
                </motion.li>
              );
            })}
          </ul>
        </nav>

        <ActionLink
          href={CLI_URL}
          className="relative z-[80] justify-self-end [--btn-h:2.5rem] max-[380px]:hidden"
          entrance={{ kind: "scale", delay: 0.34 }}
        >
          Get the CLI
        </ActionLink>

        <motion.button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Close menu" : "Open menu"}
          className="relative z-[80] grid size-11 place-items-center rounded-[10px] border border-border-strong/40 bg-white/55 backdrop-blur-md transition-colors hover:border-ink/50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-signal-deep lg:hidden"
          {...appear("scale", 0.34, reduce)}
        >
          <span aria-hidden="true" className="relative block h-3.5 w-4">
            <span
              className={cn(
                "absolute left-0 h-[1.5px] w-4 rounded-full bg-ink transition-transform duration-300 motion-reduce:transition-none",
                open ? "top-1.5 rotate-45" : "top-0",
              )}
            />
            <span
              className={cn(
                "absolute top-1.5 left-0 h-[1.5px] w-4 rounded-full bg-ink transition-opacity duration-200",
                open && "opacity-0",
              )}
            />
            <span
              className={cn(
                "absolute left-0 h-[1.5px] w-4 rounded-full bg-ink transition-transform duration-300 motion-reduce:transition-none",
                open ? "top-1.5 -rotate-45" : "top-3",
              )}
            />
          </span>
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            className="fixed inset-0 z-[70] flex flex-col bg-paper/75 px-5 pt-[max(6rem,calc(env(safe-area-inset-top)+5.5rem))] pb-8 backdrop-blur-2xl lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.28 }}
          >
            <nav aria-label="Primary">
              <ul className="flex flex-col gap-2">
                {NAV_ITEMS.map((item, i) => (
                  <motion.li
                    key={item.href}
                    initial={reduce ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.05 + i * 0.05, ease: EASE_OUT }}
                  >
                    <a
                      ref={i === 0 ? firstLinkRef : undefined}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex h-14 items-center rounded-[10px] border border-border-strong/30 bg-white/60 px-5 text-[1.1875rem] font-medium tracking-[-0.02em] text-ink focus-visible:outline-3 focus-visible:outline-signal-deep"
                    >
                      {item.label}
                    </a>
                  </motion.li>
                ))}
              </ul>
            </nav>
            <ActionLink
              href={CLI_URL}
              className="mt-auto w-full [--btn-h:3rem]"
              onClick={() => setOpen(false)}
            >
              Get the CLI
            </ActionLink>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
