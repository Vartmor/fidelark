/**
 * Small, faithful renderings of the repository's fixture artifacts (the artifact.html files under fixtures/),
 * as they look where they were made. Sized in cqw so each card is a scaled page.
 * Their styling belongs to the artifacts, not to the Fidelark brand.
 */
import type { ReactNode } from "react";

const sys = "font-[system-ui,sans-serif]";

function MinimalQuiz() {
  return (
    <div className={`${sys} flex h-full flex-col gap-[3cqw] bg-white p-[7cqw] text-[#111827]`}>
      <p className="text-[6cqw] font-bold tracking-[-0.02em]">What is 2 + 2?</p>
      <div className="flex flex-col gap-[1.8cqw] text-[3.2cqw]">
        {["3", "4", "5"].map((n) => (
          <span key={n} className="flex items-center gap-[1.8cqw]">
            <span
              className={`grid size-[3.4cqw] place-items-center rounded-full border-[0.4cqw] ${n === "4" ? "border-[#0f766e]" : "border-[#9ca3af]"}`}
            >
              {n === "4" && <span className="size-[1.6cqw] rounded-full bg-[#0f766e]" />}
            </span>
            {n}
          </span>
        ))}
      </div>
      <span className="w-fit rounded-[1cqw] bg-[#1f2937] px-[3cqw] py-[1.4cqw] text-[2.8cqw] text-white">
        Check
      </span>
      <p className="text-[3.4cqw] font-semibold text-[#0f766e]">Correct!</p>
    </div>
  );
}

function LiveDataWidget() {
  return (
    <div className={`${sys} flex h-full flex-col bg-white p-[6cqw] text-[#111827]`}>
      <p className="text-[5cqw] font-bold tracking-[-0.02em]">Exchange rate (live)</p>
      <div className="mt-[2cqw] flex items-center gap-[1.4cqw] text-[2.2cqw] text-[#6b7280]">
        <span className="h-[1.2cqw] w-[4cqw] rounded-sm bg-[#36a2eb]" /> EUR/USD
      </div>
      <svg
        viewBox="0 0 400 170"
        className="mt-[2cqw] w-full flex-1"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {[30, 70, 110, 150].map((y) => (
          <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
        ))}
        <path
          d="M0 120 L40 110 L80 116 L120 90 L160 96 L200 70 L240 82 L280 58 L320 66 L360 40 L400 48 V170 H0 Z"
          fill="#36a2eb"
          fillOpacity=".12"
        />
        <path
          d="M0 120 L40 110 L80 116 L120 90 L160 96 L200 70 L240 82 L280 58 L320 66 L360 40 L400 48"
          fill="none"
          stroke="#36a2eb"
          strokeWidth="3"
        />
      </svg>
    </div>
  );
}

function RemoteAssets() {
  return (
    <div className="flex h-full flex-col gap-[3cqw] bg-[#fbfbfa] p-[6cqw] font-sans text-[#24292f]">
      <p className="text-[5.4cqw] font-semibold tracking-[-0.03em]">Binary search</p>
      <div className="flex gap-[1cqw]">
        {[2, 5, 8, 12, 16, 23, 38, 56, 72].map((n, i) => (
          <span
            key={n}
            className={`grid h-[7cqw] flex-1 place-items-center rounded-[0.8cqw] border border-[#d0d7de] text-[2.4cqw] font-medium ${i === 4 ? "border-[#85be9e] bg-[#b8e4cc]" : "bg-white"}`}
          >
            {n}
          </span>
        ))}
      </div>
      <pre className="rounded-[1.2cqw] border border-[#d0d7de] bg-[#f6f8fa] p-[2.6cqw] font-mono text-[2.3cqw] leading-[1.5] whitespace-pre-wrap">
        <span className="text-[#cf222e]">function</span>{" "}
        <span className="text-[#8250df]">search</span>(xs, x) {"{"}
        {"\n  "}
        <span className="text-[#cf222e]">return</span> xs.
        <span className="text-[#8250df]">indexOf</span>(x);
        {"\n}"}
      </pre>
    </div>
  );
}

function PlatformHostApi() {
  return (
    <div
      className={`${sys} flex h-full flex-col gap-[2.6cqw] bg-[#0f1b2d] p-[6cqw] text-[#e5edf7]`}
    >
      <p className="text-[5cqw] font-bold tracking-[-0.02em]">Ask the tutor</p>
      <div className="rounded-[1.2cqw] border border-[#2b3c55] bg-[#16243a] p-[2.6cqw] text-[2.8cqw] text-[#a9b8cc]">
        Why do leaves change color in autumn?
      </div>
      <span className="w-fit rounded-[1cqw] bg-[#4f7cff] px-[3cqw] py-[1.3cqw] text-[2.6cqw] font-semibold text-white">
        Ask
      </span>
      <p className="text-[2.7cqw] leading-[1.5] text-[#c7d3e3]">
        As days shorten, trees stop making chlorophyll, so the yellow and orange pigments already in
        the leaf show through.
      </p>
    </div>
  );
}

function StaticArticle() {
  return (
    <div className="flex h-full flex-col gap-[2.4cqw] bg-[#fffdf8] px-[8cqw] py-[6cqw] font-[Georgia,serif] text-[#1f2328]">
      <p className="text-[5cqw] leading-[1.15]">Why fidelity needs evidence</p>
      <p className="text-[2.6cqw] leading-[1.6] text-[#4b5563]">
        A portable artifact should say what survives. This page has no scripts and no external
        files.
      </p>
      <svg viewBox="0 0 120 60" className="mt-[1cqw] w-[30cqw]" aria-hidden="true">
        <rect x="10" y="20" width="40" height="40" fill="#152D2B" />
        <rect x="70" y="5" width="40" height="55" fill="#F18A63" />
      </svg>
      <p className="text-[2.2cqw] text-[#6b7280] italic">An inline SVG chart.</p>
    </div>
  );
}

function ReactFlashcards() {
  return (
    <div className="grid h-full place-items-center bg-[linear-gradient(160deg,#eef3fb,#dfe8f6)] p-[6cqw] font-sans">
      <div className="flex w-[70cqw] flex-col items-center gap-[3cqw] rounded-[2.4cqw] bg-white p-[5cqw] shadow-[0_2cqw_5cqw_-2cqw_rgb(30_50_90/0.25)]">
        <span className="text-[2.2cqw] font-medium tracking-[0.08em] text-[#64748b] uppercase">
          Card 2 of 2
        </span>
        <p className="text-[5cqw] font-semibold tracking-[-0.02em] text-[#0f172a]">
          Capital of France
        </p>
        <div className="flex gap-[2cqw] text-[2.6cqw] font-semibold">
          <span className="rounded-[1.2cqw] bg-[#0f172a] px-[3.4cqw] py-[1.4cqw] text-white">
            Show
          </span>
          <span className="rounded-[1.2cqw] border border-[#cbd5e1] px-[3.4cqw] py-[1.4cqw] text-[#0f172a]">
            Next
          </span>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="flex h-full flex-col gap-[3cqw] bg-[#f4f6f8] p-[5.5cqw] font-sans text-[#1e293b]">
      <p className="text-[4.6cqw] font-semibold tracking-[-0.02em]">Quarterly dashboard</p>
      <div className="flex flex-1 gap-[3cqw]">
        <div className="flex flex-1 items-end gap-[2.4cqw] rounded-[1.6cqw] bg-white p-[3cqw]">
          {[44, 58, 51, 76].map((h, i) => (
            <div key={h} className="flex flex-1 flex-col items-center gap-[1cqw]">
              <span
                className="w-full rounded-t-[0.8cqw] bg-[#3b82f6]"
                style={{ height: `${h * 0.32}cqw` }}
              />
              <span className="text-[2cqw] text-[#64748b]">Q{i + 1}</span>
            </div>
          ))}
        </div>
        <div className="flex w-[32cqw] flex-col gap-[1.6cqw] rounded-[1.6cqw] bg-white p-[3cqw] text-[2.1cqw]">
          {["North", "South", "East", "West"].map((r, i) => (
            <div key={r} className="flex items-center justify-between gap-[2cqw]">
              <span>{r}</span>
              <span
                className="h-[1.2cqw] rounded-full bg-[#cbd5e1]"
                style={{ width: `${8 + i * 3}cqw` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SurveyForm() {
  return (
    <div className={`${sys} flex h-full gap-[4cqw] bg-white p-[6cqw] text-[#111827]`}>
      <div className="flex flex-1 flex-col gap-[2.4cqw]">
        <p className="text-[5cqw] font-bold tracking-[-0.02em]">Quick survey</p>
        <span className="text-[2.4cqw] text-[#4b5563]">Email</span>
        <span className="h-[6cqw] rounded-[1cqw] border border-[#d1d5db]" />
        <span className="w-fit rounded-[1cqw] bg-[#dc2626] px-[3cqw] py-[1.3cqw] text-[2.6cqw] font-semibold text-white">
          Send
        </span>
        <span className="text-[2.4cqw] text-[#2563eb] underline">Help</span>
      </div>
      <div className="grid w-[30cqw] place-items-center self-start rounded-[1cqw] border border-dashed border-[#d1d5db] bg-[#f9fafb] py-[9cqw] text-[2cqw] text-[#9ca3af]">
        Advertisement
      </div>
    </div>
  );
}

function PreactCounter() {
  return (
    <div className="grid h-full place-items-center bg-[#1c1a22] font-sans">
      <span className="rounded-[1.6cqw] bg-[#f5f3f7] px-[5cqw] py-[2.6cqw] text-[3.4cqw] font-semibold text-[#1c1a22]">
        Clicked 3 times
      </span>
    </div>
  );
}

export const ARTIFACTS: Record<string, () => ReactNode> = {
  "minimal-quiz": MinimalQuiz,
  "live-data-widget": LiveDataWidget,
  "remote-assets": RemoteAssets,
  "platform-host-api": PlatformHostApi,
  "static-article": StaticArticle,
  "react-babel-cdn": ReactFlashcards,
  "missing-local-files": Dashboard,
  "form-exfiltration": SurveyForm,
  "module-bare-import": PreactCounter,
};
