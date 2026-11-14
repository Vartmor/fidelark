import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PortabilityReport } from "@fidelark/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InputError, inspectBytes, inspectFile } from "./inspect.ts";

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
  it("produces a valid report with hash, format and no guessed fidelity", () => {
    const report = inspectBytes("/some/private/path/quiz.html", html, { now: fixedNow });
    expect(PortabilityReport.safeParse(report).success).toBe(true);
    expect(report.input).toEqual({
      name: "quiz.html",
      format: "html",
      sizeBytes: html.byteLength,
      sha256: createHash("sha256").update(html).digest("hex"),
    });
    expect(report.generatedAt).toBe("2026-11-14T12:00:00.000Z");
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
