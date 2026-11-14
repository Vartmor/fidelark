import { type PortabilityReport, SCHEMA_VERSION } from "@fidelark/schema";
import { describe, expect, it } from "vitest";
import { formatReport } from "./format.ts";

const axis = (c: "exact-portable" | "connected") => ({ class: c, evidence: [] });

const analyzed: PortabilityReport = {
  schemaVersion: SCHEMA_VERSION,
  tool: { name: "fidelark", version: "0.0.0" },
  generatedAt: "2026-11-14T12:00:00.000Z",
  input: { name: "widget.html", format: "html", sizeBytes: 866, sha256: "a".repeat(64) },
  analysis: {
    capabilities: ["network-fetch"],
    dependencies: [],
    permissions: { scripts: true, network: true, storage: false },
    fidelity: {
      overall: "connected",
      axes: {
        content: axis("exact-portable"),
        visual: axis("exact-portable"),
        behavioral: axis("connected"),
      },
    },
    exportOptions: ["standalone-html"],
  },
  findings: [],
};

describe("formatReport", () => {
  it("shows fidelity with the brand notation: glyph and text label, per axis", () => {
    const out = formatReport(analyzed);
    expect(out).toContain("Fidelity  ↗ Connected");
    expect(out).toContain("content     ● Exact portable");
    expect(out).toContain("behavioral  ↗ Connected");
  });

  it("never guesses fidelity when the input was not analyzed", () => {
    expect(formatReport({ ...analyzed, analysis: null })).toContain("Fidelity  not assessed");
  });
});
