import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  FIDELITY_CLASSES,
  jsonSchemas,
  PortabilityReport,
  SCHEMA_VERSION,
  serializeJsonSchema,
  worstFidelity,
} from "./index.ts";

const validReport = {
  schemaVersion: SCHEMA_VERSION,
  tool: { name: "fidelark", version: "0.0.0" },
  generatedAt: "2026-11-14T12:00:00.000Z",
  input: { name: "quiz.html", format: "html", sizeBytes: 120, sha256: "a".repeat(64) },
  analysis: null,
  findings: [{ code: "analysis.not-implemented", severity: "info", message: "Not yet." }],
};

describe("PortabilityReport", () => {
  it("accepts a minimal valid report", () => {
    expect(PortabilityReport.parse(validReport)).toEqual(validReport);
  });

  it("rejects unknown fidelity classes", () => {
    const axis = { class: "mostly-portable", evidence: [] };
    const report = {
      ...validReport,
      analysis: {
        capabilities: [],
        dependencies: [],
        permissions: { scripts: false, network: false, storage: false },
        fidelity: {
          overall: "mostly-portable",
          axes: { content: axis, visual: axis, behavioral: axis },
        },
        exportOptions: [],
      },
    };
    expect(PortabilityReport.safeParse(report).success).toBe(false);
  });

  it("rejects extra properties so the contract stays explicit", () => {
    expect(PortabilityReport.safeParse({ ...validReport, score: 92 }).success).toBe(false);
  });

  it("rejects malformed finding codes", () => {
    const report = {
      ...validReport,
      findings: [{ code: "Bad Code", severity: "info", message: "x" }],
    };
    expect(PortabilityReport.safeParse(report).success).toBe(false);
  });
});

describe("worstFidelity", () => {
  it("returns the least portable class", () => {
    expect(worstFidelity(["exact-portable", "connected", "bundled-portable"])).toBe("connected");
    expect(worstFidelity([...FIDELITY_CLASSES])).toBe("unsupported");
  });

  it("refuses an empty list", () => {
    expect(() => worstFidelity([])).toThrow();
  });
});

describe("published JSON Schema files", () => {
  it.each(Object.entries(jsonSchemas()))(
    "%s is up to date (run pnpm schema:emit)",
    async (file, schema) => {
      const onDisk = await readFile(new URL(`../json-schema/${file}`, import.meta.url), "utf8");
      expect(onDisk).toBe(serializeJsonSchema(schema));
    },
  );
});
