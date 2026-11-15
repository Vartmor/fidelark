import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PortabilityReport } from "@fidelark/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InputError, inspectBytes, inspectFile } from "./inspect.ts";
import { buildZip } from "./testing.ts";

const fixedNow = () => new Date("2026-11-14T12:00:00.000Z");
const html = new TextEncoder().encode("<!doctype html><html><body>Hi</body></html>");

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "fidelark-inspect-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("inspectBytes", () => {
  it("analyzes HTML into a valid report with hash, format and fidelity", () => {
    const report = inspectBytes("/some/private/path/quiz.html", html, { now: fixedNow });
    expect(PortabilityReport.safeParse(report).success).toBe(true);
    expect(report.input).toEqual({
      name: "quiz.html",
      format: "html",
      sizeBytes: html.byteLength,
      sha256: createHash("sha256").update(html).digest("hex"),
    });
    expect(report.generatedAt).toBe("2026-11-14T12:00:00.000Z");
    expect(report.analysis?.fidelity.overall).toBe("exact-portable");
    expect(report.findings.map((f) => f.code)).toEqual(["fidelity.unverified"]);
  });

  it("does not guess fidelity for formats without an analyzer", () => {
    const markdown = new TextEncoder().encode("# Notes\n\nSome text.");
    const report = inspectBytes("notes.md", markdown);
    expect(report.analysis).toBeNull();
    expect(report.findings.map((f) => f.code)).toEqual(["analysis.not-implemented"]);
  });

  it("does not hash or classify inputs over the size limit", () => {
    const report = inspectBytes("big.html", html, { limits: { maxInputBytes: 10 } });
    expect(report.input.sha256).toBeNull();
    expect(report.input.format).toBe("unknown");
    expect(report.findings.map((f) => f.code)).toEqual(["input.too-large"]);
  });
});

describe("inspectBytes with ZIP input", () => {
  const codes = (bytes: Uint8Array, entry?: string) =>
    inspectBytes("export.zip", bytes, entry === undefined ? {} : { entry }).findings.map(
      (f) => `${f.severity} ${f.code}`,
    );

  it("reports an archive it cannot read without guessing fidelity", () => {
    const report = inspectBytes("export.zip", new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]));
    expect(report.input.format).toBe("zip");
    expect(report.analysis).toBeNull();
    expect(report.archive).toEqual({ entry: null, files: [], skipped: [], totalBytes: 0 });
    expect(report.findings.map((f) => f.code)).toEqual(["zip.unreadable"]);
  });

  it("chooses index.html, then the only page, and otherwise explains why it cannot", () => {
    const index = buildZip([
      { name: "about.html", content: "<p>About</p>" },
      { name: "index.html", content: "<p>Home</p>" },
    ]);
    expect(inspectBytes("export.zip", index).archive?.entry).toBe("index.html");
    expect(
      inspectBytes("export.zip", buildZip([{ name: "deck/slides.htm", content: "x" }])).archive
        ?.entry,
    ).toBe("deck/slides.htm");
    expect(codes(buildZip([{ name: "notes.txt", content: "x" }]))).toEqual(["error zip.no-entry"]);
    expect(codes(index, "missing.html")).toEqual(["error zip.entry-not-found"]);
    expect(inspectBytes("export.zip", index, { entry: "./about.html" }).archive?.entry).toBe(
      "about.html",
    );
  });

  it("warns when an entry is chosen for input that is not a ZIP", () => {
    const report = inspectBytes("quiz.html", html, { entry: "index.html" });
    expect(report.findings.map((f) => f.code)).toContain("input.entry-ignored");
  });
});

describe("inspectFile", () => {
  it("inspects a file on disk", async () => {
    const path = join(dir, "artifact.html");
    await writeFile(path, html);
    const report = await inspectFile(path, { now: fixedNow });
    expect(report.input.name).toBe("artifact.html");
    expect(report.input.format).toBe("html");
  });

  it("checks the size limit before reading", async () => {
    const path = join(dir, "large.html");
    await writeFile(path, html);
    const report = await inspectFile(path, { limits: { maxInputBytes: 5 } });
    expect(report.input.sizeBytes).toBe(html.byteLength);
    expect(report.input.sha256).toBeNull();
  });

  it("throws InputError for missing files and directories", async () => {
    await expect(inspectFile(join(dir, "missing.html"))).rejects.toBeInstanceOf(InputError);
    await expect(inspectFile(dir)).rejects.toBeInstanceOf(InputError);
  });
});
