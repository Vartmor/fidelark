import { fidelityLabel, type PortabilityReport } from "@fidelark/schema";

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

/** Human-readable summary of a report. The JSON output (`--json`) is the stable interface. */
export function formatReport(report: PortabilityReport): string {
  const { input, analysis, findings } = report;
  const rows: [string, string][] = [
    ["File", input.name],
    ["Format", input.format],
    ["Size", formatBytes(input.sizeBytes)],
    ["SHA-256", input.sha256 ?? "(not computed)"],
  ];
  if (analysis) {
    const { overall, axes } = analysis.fidelity;
    rows.push(
      ["Fidelity", fidelityLabel(overall)],
      ["", `content     ${fidelityLabel(axes.content.class)}`],
      ["", `visual      ${fidelityLabel(axes.visual.class)}`],
      ["", `behavioral  ${fidelityLabel(axes.behavioral.class)}`],
    );
  } else {
    rows.push(["Fidelity", "not assessed"]);
  }
  const lines = rows.map(([label, value]) => `  ${label.padEnd(9)} ${value}`);

  if (findings.length > 0) {
    lines.push("", "Findings");
    const codeWidth = Math.max(...findings.map((f) => f.code.length));
    for (const f of findings) {
      lines.push(`  ${f.severity.padEnd(8)} ${f.code.padEnd(codeWidth)}  ${f.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
