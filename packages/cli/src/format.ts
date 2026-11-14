import {
  type AxisAssessment,
  type ConversionResult,
  type Finding,
  fidelityLabel,
  type PortabilityReport,
  type VerificationResult,
} from "@fidelark/schema";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

const LABEL_WIDTH = 9;
const row = (label: string, value: string) => `  ${label.padEnd(LABEL_WIDTH)} ${value}`;
const indent = " ".repeat(LABEL_WIDTH + 3);

function axisLines(name: string, axis: AxisAssessment): string[] {
  return [
    `${indent}${name.padEnd(11)} ${fidelityLabel(axis.class)}`,
    ...axis.evidence.map((e) => `${indent}  · ${e}`),
  ];
}

/** Human-readable summary of a report. The JSON output (`--json`) is the stable interface. */
export function formatReport(report: PortabilityReport): string {
  const { input, analysis, findings } = report;
  const lines = [
    row("File", input.name),
    row("Format", input.format),
    row("Size", formatBytes(input.sizeBytes)),
    row("SHA-256", input.sha256 ?? "(not computed)"),
  ];

  if (analysis) {
    const { overall, axes } = analysis.fidelity;
    const needs = Object.entries(analysis.permissions)
      .filter(([, needed]) => needed)
      .map(([name]) => name);
    lines.push(
      row("Fidelity", `${fidelityLabel(overall)}  (static analysis, not yet verified offline)`),
      ...axisLines("content", axes.content),
      ...axisLines("visual", axes.visual),
      ...axisLines("behavioral", axes.behavioral),
      row("Needs", needs.length > 0 ? needs.join(", ") : "nothing beyond a browser"),
      row("Uses", analysis.capabilities.join(", ")),
    );

    if (analysis.dependencies.length > 0) {
      lines.push("", `Dependencies (${analysis.dependencies.length})`);
      const kindWidth = Math.max(...analysis.dependencies.map((d) => d.kind.length));
      const locWidth = Math.max(...analysis.dependencies.map((d) => d.location.length));
      for (const d of analysis.dependencies) {
        lines.push(
          `  ${d.kind.padEnd(kindWidth)}  ${d.location.padEnd(locWidth)}  ${d.specifier}  (${d.evidence[0] ?? ""})`,
        );
      }
    }
  } else {
    lines.push(row("Fidelity", "not assessed"));
  }

  lines.push(...findingLines(findings));
  return `${lines.join("\n")}\n`;
}

function findingLines(findings: readonly Finding[]): string[] {
  if (findings.length === 0) return [];
  const lines = ["", "Findings"];
  const codeWidth = Math.max(...findings.map((f) => f.code.length));
  for (const f of findings) {
    lines.push(`  ${f.severity.padEnd(8)} ${f.code.padEnd(codeWidth)}  ${f.message}`);
    for (const e of f.evidence ?? []) lines.push(`  ${" ".repeat(9 + codeWidth)}  - ${e}`);
  }
  return lines;
}

const fidelityOf = (report: PortabilityReport) =>
  report.analysis ? fidelityLabel(report.analysis.fidelity.overall) : "not assessed";

/** Summary of `convert`: what was embedded, what stayed external, and fidelity before → after. */
export function formatConversion(result: ConversionResult, outputPath: string): string {
  const { manifest, before, after } = result;
  const remote = manifest.bundled.filter((b) => b.from === "remote").length;
  const bytes = manifest.bundled.reduce((sum, b) => sum + b.bytes, 0);
  const lines = [
    row("Input", `${before.input.name}  (${formatBytes(before.input.sizeBytes)})`),
    row("Output", `${outputPath}  (${formatBytes(after.input.sizeBytes)})`),
    row(
      "Embedded",
      manifest.bundled.length === 0
        ? "nothing"
        : `${manifest.bundled.length} resource${manifest.bundled.length === 1 ? "" : "s"}, ${formatBytes(bytes)} (${manifest.bundled.length - remote} local, ${remote} remote)`,
    ),
    row(
      "External",
      manifest.skipped.length === 0 ? "none" : `${manifest.skipped.length} (see findings)`,
    ),
    row(
      "Fidelity",
      `${fidelityOf(before)}  →  ${fidelityOf(after)}  (static analysis, not yet verified offline)`,
    ),
  ];
  if (after.analysis) {
    const { axes } = after.analysis.fidelity;
    lines.push(
      ...axisLines("content", axes.content),
      ...axisLines("visual", axes.visual),
      ...axisLines("behavioral", axes.behavioral),
    );
  }
  lines.push(...findingLines(result.findings), "", `Next: fidelark verify ${outputPath}`);
  return `${lines.join("\n")}\n`;
}

const VERDICTS: Record<VerificationResult["verdict"], string> = {
  passed: "passed — works offline with no blocked requests and no errors",
  partial: "partial — opens offline, but some parts are blocked, raise errors or need a connection",
  failed: "failed — the page did not load, or stayed blank while raising errors or being blocked",
  "not-run": "not run — only the static check was done",
};

/** Summary of `verify`: static self-containment plus what happened in the offline browser. */
export function formatVerification(result: VerificationResult): string {
  const { browser } = result;
  const lines = [
    row("File", result.input.name),
    row(
      "Embedded",
      result.selfContained
        ? "all scripts, styles, fonts, images and media"
        : `${result.unbundled.length} file${result.unbundled.length === 1 ? "" : "s"} still external`,
    ),
  ];
  if (browser) {
    lines.push(
      row(
        "Browser",
        `${browser.browser} (${browser.sandboxed ? "sandboxed" : "NOT sandboxed"}, network blocked)`,
      ),
      row(
        "Loaded",
        browser.loaded ? `yes, ${browser.renderedTextChars} characters of visible text` : "no",
      ),
      row(
        "Blocked",
        `${browser.blockedRequests.length} request${browser.blockedRequests.length === 1 ? "" : "s"}`,
      ),
      row(
        "Errors",
        `${browser.pageErrors.length} uncaught, ${browser.consoleErrors.length} console`,
      ),
    );
  } else {
    lines.push(row("Browser", "not run"));
  }
  lines.push(row("Verdict", VERDICTS[result.verdict]), ...findingLines(result.findings));
  return `${lines.join("\n")}\n`;
}
