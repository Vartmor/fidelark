import { type AxisAssessment, fidelityLabel, type PortabilityReport } from "@fidelark/schema";

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

  if (findings.length > 0) {
    lines.push("", "Findings");
    const codeWidth = Math.max(...findings.map((f) => f.code.length));
    for (const f of findings) {
      lines.push(`  ${f.severity.padEnd(8)} ${f.code.padEnd(codeWidth)}  ${f.message}`);
      for (const e of f.evidence ?? []) lines.push(`  ${" ".repeat(9 + codeWidth)}  - ${e}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
