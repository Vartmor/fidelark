import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FixtureManifest } from "@fidelark/schema";
import { findBrowser, type VerifyOptions, verifyFile } from "@fidelark/verifier";
import { describe, expect, it } from "vitest";
import { BROWSER_TEST_TIMEOUT } from "../packages/verifier/src/testing.ts";

const FIXTURES = fileURLToPath(new URL("../fixtures/", import.meta.url));
const VERDICT = { works: "passed", partial: "partial", fails: "failed" } as const;

const manifests = (await readdir(FIXTURES, { withFileTypes: true, recursive: true }))
  .filter((e) => e.isFile() && e.name === "fixture.json")
  .map((e) => join(e.parentPath, e.name))
  .sort();

/** Opens every fixture offline in a real browser and compares the verdict with `expected.offline`. */
describe.skipIf((await findBrowser()) === null)("offline corpus", () => {
  // Fixtures are trusted test files; they are opened in the sandboxed browser.
  const options: VerifyOptions = { settleMs: 500, timeoutMs: 30_000 };

  it.each(manifests.map((m) => [m.slice(FIXTURES.length), m]))(
    "%s",
    async (_label, path) => {
      const manifest = FixtureManifest.parse(JSON.parse(await readFile(path, "utf8")));
      const expected = manifest.expected.offline;
      if (expected === "not-tested") return;
      const result = await verifyFile(join(dirname(path), manifest.artifact.path), options);
      expect(result.verdict, JSON.stringify(result.browser)).toBe(VERDICT[expected]);
    },
    BROWSER_TEST_TIMEOUT,
  );
});
