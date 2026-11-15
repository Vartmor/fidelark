import reports from "virtual:site-reports";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MaskedTextReveal } from "@/components/ui/text-reveal-mask";
import { ARTIFACTS } from "./artifact-cards";

/** Distance from the belt's top to the cards; room for the counter above the line. */
const CARD_TOP = 76;
const RADIUS = 14;
// Brand palette: pale signal at the line, deeper signal and a little mint further away.
const HOT = ["#FCE3D7", "#F6F3EC", "#FFFFFF"];
const PALETTE = ["#AF4524", "#C9582F", "#F18A63", "#F18A63", "#F7A887", "#FCE3D7", "#B8E4CC"];

/** Deterministic 32-bit hash to [0, 1): stable dithering without randomness per frame. */
function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
};

export function ScannerBelt() {
  const reduce = useReducedMotion() ?? false;
  const [paused, setPaused] = useState(false);
  const stopped = useRef(false);
  const beltRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const codeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const chipRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const unitRef = useRef<HTMLSpanElement>(null);
  /** Set by the animation loop: pushes the belt one card back (-1) or forward (+1). */
  const nudgeRef = useRef<(direction: -1 | 1) => void>(() => {});

  useEffect(() => {
    stopped.current = paused || reduce;
  }, [paused, reduce]);

  useEffect(() => {
    const belt = beltRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!belt || !canvas || !ctx) return;
    const cards = cardRefs.current;
    const codes = codeRefs.current;
    const n = reports.length;

    let W = 0;
    let H = 0;
    let cw = 0;
    let ch = 0;
    let gap = 0;
    let Lx = 0;
    let off = 0;
    let vel = 0;
    let hover = 0;
    let hoverTarget = 0;
    let dragging = false;
    let lastX = 0;
    let lastT = 0;
    let dragVel = 0;
    let crossing = -1;
    let shown = 0;
    let prev = 0;
    let raf = 0;
    let visible = false;
    const sparks: Spark[] = [];

    const measure = () => {
      const rect = belt.getBoundingClientRect();
      const first = cards[0]?.getBoundingClientRect();
      const firstMeasure = W === 0;
      W = rect.width;
      H = rect.height;
      cw = first?.width ?? 0;
      ch = first?.height ?? 0;
      gap = W < 768 ? W * 0.07 : Math.max(28, W * 0.045);
      Lx = W / 2;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Start with the first card a third of the way through the line.
      if (firstMeasure) off = Lx - 0.62 * cw;
    };

    const setCounter = (index: number) => {
      const report = reports[index];
      if (!report || !chipRef.current || !unitRef.current) return;
      chipRef.current.dataset.grade = report.fidelity;
      chipRef.current.textContent = `${report.glyph} ${report.label}`;
      unitRef.current.textContent = report.dependencies === 1 ? "dependency" : "dependencies";
      shown = 0;
    };

    const drawFx = (index: number, x: number, cut: number, t: number) => {
      const top = CARD_TOP;
      // Haze on the card side of the line.
      const hazeW = Math.min(150, x + cw - Lx);
      if (hazeW > 0) {
        const g = ctx.createLinearGradient(Lx, 0, Lx + 150, 0);
        g.addColorStop(0, "rgba(241,138,99,0.32)");
        g.addColorStop(1, "rgba(241,138,99,0)");
        ctx.fillStyle = g;
        ctx.fillRect(Lx, top, hazeW, ch);
      }
      // Dithered particles fixed to the card surface (3px grid in card coordinates).
      const R = 0.3 * cw;
      const rows = Math.ceil(ch / 3);
      const startCol = Math.floor(cut / 3);
      const endCol = Math.min(Math.floor((cut + R) / 3), Math.floor(cw / 3));
      for (let gx = startCol; gx <= endCol; gx++) {
        const sx = x + gx * 3;
        const d = sx - Lx;
        if (d < 0 || d > R) continue;
        const p = (1 - d / R) ** 1.7;
        for (let row = -5; row < rows + 5; row++) {
          const inside = row >= 0 && row < rows;
          const edge = inside ? 0 : row < 0 ? -row : row - rows + 1;
          const chance = inside ? p * 0.92 : p * 0.16 * (1 - edge / 6);
          if (hash(gx, row, index) >= chance) continue;
          if (!reduce && hash(gx, row, Math.floor(t * 9) + 97) < 0.22) continue;
          const h2 = hash(row, gx, index + 31);
          ctx.fillStyle =
            d < 10
              ? (HOT[Math.floor(h2 * HOT.length)] ?? "#FFFFFF")
              : (PALETTE[Math.floor(h2 * h2 * PALETTE.length)] ?? "#F18A63");
          const size = 1.1 + h2 * 1.7;
          const jx = reduce ? 0 : (hash(gx, row, 7) - 0.5) * 1.6;
          const jy = reduce ? 0 : (hash(row, gx, 11) - 0.5) * 1.6;
          ctx.fillRect(sx + jx, top + row * 3 + jy, size, size);
        }
      }
      // Free sparks drifting off the line like embers.
      if (!reduce && !stopped.current) {
        for (let k = 0; k < 3; k++) {
          if (Math.random() > 0.7 || sparks.length > 220) continue;
          sparks.push({
            x: Lx + Math.random() * 30,
            y: top - 10 + Math.random() * (ch + 20),
            vx: -30 + Math.random() * 70 + vel * 0.6,
            vy: (Math.random() - 0.5) * 50,
            life: 0.3 + Math.random() * 0.8,
            size: 0.8 + Math.random() * 1.8,
            color: PALETTE[Math.floor(Math.random() * PALETTE.length)] ?? "#F18A63",
          });
        }
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = now / 1000;
      const dt = Math.min(0.05, prev ? t - prev : 0.016);
      prev = t;
      if (cw === 0) measure();

      hover += (hoverTarget - hover) * (1 - Math.exp(-4 * dt));
      const auto = stopped.current ? 0 : -0.06 * W;
      const target = auto * (1 - 0.65 * hover);
      if (!dragging) {
        vel += (target - vel) * (1 - Math.exp(-2.2 * dt));
        off += vel * dt;
      }

      const span = cw + gap;
      const period = span * n;
      ctx.clearRect(0, 0, W, H);
      let nowCrossing = -1;
      let progress = 0;

      for (let i = 0; i < n; i++) {
        const card = cards[i];
        const code = codes[i];
        if (!card || !code) continue;
        const x = mod(off + i * span + span, period) - span;
        const cut = clamp(Lx - x, 0, cw);
        const move = `translate3d(${x}px,0,0)`;
        card.style.transform = move;
        code.style.transform = move;
        if (cut > 0) {
          card.style.clipPath = `inset(0 0 0 ${cut}px round 0 ${RADIUS}px ${RADIUS}px 0)`;
          const mask = `linear-gradient(90deg, transparent ${cut}px, #000 ${cut + 26}px)`;
          card.style.maskImage = mask;
          card.style.setProperty("-webkit-mask-image", mask);
          code.style.clipPath = `inset(0 ${cw - cut}px 0 0)`;
          code.style.visibility = "visible";
        } else {
          card.style.clipPath = "";
          card.style.maskImage = "";
          card.style.setProperty("-webkit-mask-image", "");
          code.style.visibility = "hidden";
        }
        if (cut > 0 && cut < cw) {
          nowCrossing = i;
          progress = cut / cw;
        }
        if (cut > 0 && x + cw > Lx) drawFx(i, x, cut, t);
      }

      for (let s = sparks.length - 1; s >= 0; s--) {
        const spark = sparks[s];
        if (!spark) continue;
        spark.life -= dt;
        if (spark.life <= 0) {
          sparks.splice(s, 1);
          continue;
        }
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        ctx.globalAlpha = Math.min(1, spark.life * 2.2);
        ctx.fillStyle = spark.color;
        ctx.fillRect(spark.x, spark.y, spark.size, spark.size);
      }
      ctx.globalAlpha = 1;

      if (nowCrossing !== -1 && nowCrossing !== crossing) {
        crossing = nowCrossing;
        setCounter(crossing);
      }
      const report = reports[crossing];
      if (report && countRef.current) {
        const goal =
          nowCrossing === crossing
            ? Math.round(report.dependencies * Math.min(1, progress * 1.4))
            : report.dependencies;
        shown += (goal - shown) * Math.min(1, dt * 14);
        countRef.current.textContent = String(Math.round(shown));
      }
    };

    const start = () => {
      if (!raf) {
        prev = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // Run only while the belt is on screen and the tab is visible.
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible && !document.hidden) start();
      else stop();
    });
    io.observe(belt);
    const onVisibility = () => (visible && !document.hidden ? start() : stop());
    document.addEventListener("visibilitychange", onVisibility);
    const ro = new ResizeObserver(measure);
    ro.observe(belt);

    const onDown = (e: PointerEvent) => {
      dragging = true;
      belt.setPointerCapture(e.pointerId);
      lastX = e.clientX;
      lastT = e.timeStamp;
      dragVel = 0;
      belt.dataset.dragging = "true";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      off += dx;
      const ms = Math.max(8, e.timeStamp - lastT);
      dragVel = (dx / ms) * 1000 * 0.8 + dragVel * 0.2;
      lastX = e.clientX;
      lastT = e.timeStamp;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      vel = dragVel;
      delete belt.dataset.dragging;
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hoverTarget = 1;
    };
    const onLeave = () => {
      hoverTarget = 0;
    };
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      vel -= e.deltaX * 6;
    };
    nudgeRef.current = (direction) => {
      vel -= direction * (cw + gap) * 1.8;
      start();
    };

    belt.addEventListener("pointerdown", onDown);
    belt.addEventListener("pointermove", onMove);
    belt.addEventListener("pointerup", onUp);
    belt.addEventListener("pointercancel", onUp);
    belt.addEventListener("pointerenter", onEnter);
    belt.addEventListener("pointerleave", onLeave);
    belt.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      belt.removeEventListener("pointerdown", onDown);
      belt.removeEventListener("pointermove", onMove);
      belt.removeEventListener("pointerup", onUp);
      belt.removeEventListener("pointercancel", onUp);
      belt.removeEventListener("pointerenter", onEnter);
      belt.removeEventListener("pointerleave", onLeave);
      belt.removeEventListener("wheel", onWheel);
    };
  }, [reduce]);

  const isStopped = paused || reduce;

  return (
    <section
      id="survives"
      aria-labelledby="survives-title"
      className="relative scroll-mt-16 overflow-hidden py-[clamp(4.5rem,10vh,8rem)]"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <MaskedTextReveal
          id="survives-title"
          as="h2"
          className="display text-[clamp(2.25rem,1.2rem+3vw,4rem)] text-ink"
        >
          See what survives.
        </MaskedTextReveal>
        <p className="mt-4 max-w-[38rem] text-[1.0625rem] leading-[1.6] text-slate">
          Each page below is a real test artifact. As it crosses the line, it turns into the report
          Fidelark writes for it.
        </p>
        <div className="mt-6 flex items-center gap-4 text-[0.875rem] text-slate">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            disabled={reduce}
            aria-pressed={isStopped}
            className="btn btn-glass [--btn-h:2.5rem] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStopped ? (
              <Play aria-hidden="true" className="size-4" />
            ) : (
              <Pause aria-hidden="true" className="size-4" />
            )}
            {isStopped ? "Play" : "Pause"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => nudgeRef.current(-1)}
              aria-label="Previous artifact"
              className="btn btn-glass w-10 px-0 [--btn-h:2.5rem]"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => nudgeRef.current(1)}
              aria-label="Next artifact"
              className="btn btn-glass w-10 px-0 [--btn-h:2.5rem]"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
          <span className="max-sm:hidden">Or drag the belt.</span>
        </div>
      </div>

      <div
        ref={beltRef}
        aria-hidden="true"
        className="group relative mt-10 h-[calc(var(--ch)+152px)] cursor-grab touch-pan-y select-none [--ch:calc(var(--cw)*0.6)] [--cw:84vw] data-[dragging]:cursor-grabbing md:[--cw:min(44vw,640px)]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 [mask-image:linear-gradient(90deg,transparent_0,#000_30vw)] md:[mask-image:linear-gradient(90deg,transparent_0,#000_24vw)]"
        >
          {reports.map((report, i) => (
            <div
              key={report.id}
              ref={(el) => {
                codeRefs.current[i] = el;
              }}
              className="invisible absolute top-[76px] left-0 h-[var(--ch)] w-[var(--cw)] overflow-hidden [container-type:inline-size] will-change-transform"
            >
              <pre className="m-0 p-[2.6cqw] font-mono text-[max(1.55cqw,7px)] leading-[1.42] whitespace-pre text-ink/70">
                {report.text}
              </pre>
            </div>
          ))}
        </div>

        <div aria-hidden="true" className="absolute inset-0">
          {reports.map((report, i) => {
            const Artifact = ARTIFACTS[report.id];
            return (
              <div
                key={report.id}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                className="absolute top-[76px] left-0 h-[var(--ch)] w-[var(--cw)] overflow-hidden rounded-[14px] border border-line [container-type:inline-size] shadow-[0_1px_2px_rgb(11_32_30/0.06),0_28px_60px_-34px_rgb(11_32_30/0.45)] will-change-transform"
              >
                {Artifact ? <Artifact /> : null}
              </div>
            );
          })}
        </div>

        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />

        {/* The inspection line. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[62px] left-1/2 h-[calc(var(--ch)+40px)] w-0"
        >
          <span className="absolute top-[4%] left-0 h-[92%] w-9 bg-[linear-gradient(90deg,rgb(241_138_99/0.32),transparent)] blur-[6px]" />
          <span className="absolute -left-[1.5px] h-full w-[3px] rounded-full bg-[linear-gradient(180deg,#F7A887,var(--f-signal)_12%,var(--f-signal)_88%,#F7A887)] shadow-[0_0_8px_rgb(241_138_99/0.55)]" />
        </div>

        {/* Live counter for the card crossing the line. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
        >
          <span className="font-mono text-[0.6875rem] tracking-[0.06em] text-slate uppercase">
            Inspected
          </span>
          <span className="flex h-7 items-center overflow-hidden rounded-[8px] border border-line bg-white shadow-[0_6px_18px_-8px_rgb(175_69_36/0.45)]">
            <span
              ref={chipRef}
              className="chip h-full rounded-none border-0 border-r border-line"
              data-grade={reports[0]?.fidelity}
            >
              {reports[0] ? `${reports[0].glyph} ${reports[0].label}` : ""}
            </span>
            <span className="flex items-baseline gap-1 px-2.5 font-mono text-[0.75rem] font-semibold text-ink tabular-nums">
              <span ref={countRef}>0</span>
              <span ref={unitRef} className="font-normal text-slate">
                dependencies
              </span>
            </span>
          </span>
        </div>
      </div>

      <ul className="sr-only">
        {reports.map((r) => (
          <li key={r.id}>
            {r.title}: {r.label}, {r.dependencies}{" "}
            {r.dependencies === 1 ? "dependency" : "dependencies"}, {r.findings}{" "}
            {r.findings === 1 ? "finding" : "findings"}.
          </li>
        ))}
      </ul>
    </section>
  );
}
