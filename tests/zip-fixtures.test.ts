import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { convertFile } from "@fidelark/core";
import { findBrowser, verifyFile } from "@fidelark/verifier";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { zipFixtures } from "../packages/core/scripts/zip-fixtures.ts";
import { BROWSER_TEST_TIMEOUT } from "../packages/verifier/src/testing.ts";

const FIXTURES = fileURLToPath(new URL("../fixtures/", import.meta.url));
const fixture = (id: string) => join(FIXTURES, id, "artifact.zip");

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "fidelark-zip-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("ZIP fixtures", () => {
  it.each(Object.entries(zipFixtures()))("%s is built by zip-fixtures.ts", async (path, bytes) => {
    // The archives are binary; this keeps them identical to their reviewable source.
    expect(new Uint8Array(await readFile(join(FIXTURES, path)))).toEqual(bytes);
  });

  it("converts a bundler export honestly: module graphs and missing files stay external", async () => {
    const { result } = await convertFile(fixture("synthetic/dashboard-export-zip"), "out.html");
    expect(result.manifest.bundled.map((b) => b.specifier)).toEqual(["/assets/index-b71e02.css"]);
    expect(result.manifest.skipped.map((s) => `${s.specifier}: ${s.reason}`)).toEqual([
      "/assets/index-3f9a1c.js: ES module graphs are not bundled yet",
      "/assets/logo.png: file not found in the archive",
    ]);
  });

  it("never resolves a reference outside the archive", async () => {
    const { result } = await convertFile(fixture("adversarial/zip-path-traversal"), "out.html");
    expect(result.manifest.skipped.map((s) => `${s.specifier}: ${s.reason}`)).toEqual([
      "../escape.js: outside the archive",
    ]);
  });
});

describe.skipIf((await findBrowser()) === null)("ZIP export offline", () => {
  it(
    "turns the lesson export into one file that works offline",
    async () => {
      const { html, result } = await convertFile(
        fixture("synthetic/lesson-export-zip"),
        "lesson.html",
      );
      expect(result.manifest.skipped).toEqual([]);
      expect(result.after.analysis?.fidelity.overall).toBe("exact-portable");
      const out = join(dir, "lesson.html");
      await writeFile(out, html);
      const verified = await verifyFile(out, { settleMs: 500, timeoutMs: 30_000 });
      expect(verified.verdict, JSON.stringify(verified.browser)).toBe("passed");
    },
    BROWSER_TEST_TIMEOUT,
  );
});
