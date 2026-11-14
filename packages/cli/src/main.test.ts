import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERSION } from "@fidelark/core";
import { PortabilityReport } from "@fidelark/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatBytes } from "./format.ts";
import { EXIT, main } from "./main.ts";

async function run(...argv: string[]) {
  let stdout = "";
  let stderr = "";
  const code = await main(argv, {
    stdout: (t) => {
      stdout += t;
    },
    stderr: (t) => {
      stderr += t;
    },
  });
  return { code, stdout, stderr };
}

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "fidelark-cli-"));
  await writeFile(join(dir, "quiz.html"), "<!doctype html><html><body>Quiz</body></html>");
  await writeFile(join(dir, "data.csv"), "a,b\n1,2\n");
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("fidelark CLI", () => {
  it("prints help without arguments", async () => {
    const r = await run();
    expect(r.code).toBe(EXIT.ok);
    expect(r.stdout).toContain("fidelark inspect <file>");
  });

  it("prints the version", async () => {
    expect((await run("--version")).stdout).toBe(`${VERSION}\n`);
  });

  it("prints a human-readable report", async () => {
    const r = await run("inspect", join(dir, "quiz.html"));
    expect(r.code).toBe(EXIT.ok);
    expect(r.stdout).toContain("quiz.html");
    expect(r.stdout).toContain("not assessed");
  });

  it("prints a schema-valid JSON report", async () => {
    const r = await run("inspect", join(dir, "quiz.html"), "--json");
    expect(r.code).toBe(EXIT.ok);
    expect(PortabilityReport.safeParse(JSON.parse(r.stdout)).success).toBe(true);
  });

  it("exits 1 when the report contains errors", async () => {
    const r = await run("inspect", join(dir, "data.csv"));
    expect(r.code).toBe(EXIT.findings);
    expect(r.stdout).toContain("input.unsupported-format");
  });

  it("exits 2 on usage and input errors", async () => {
    expect((await run("convert", "x.html")).code).toBe(EXIT.usage);
    expect((await run("inspect")).code).toBe(EXIT.usage);
    expect((await run("inspect", "--bogus", "x.html")).code).toBe(EXIT.usage);
    const missing = await run("inspect", join(dir, "missing.html"));
    expect(missing.code).toBe(EXIT.usage);
    expect(missing.stderr).toContain("File not found");
  });
});

describe("formatBytes", () => {
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(25 * 1024 * 1024)).toBe("25.0 MB");
  });
});
