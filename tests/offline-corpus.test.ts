import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FixtureManifest } from "@fidelark/schema";
import { findBrowser, type VerifyOptions, verifyFile } from "@fidelark/verifier";
import { beforeAll, describe, expect, it } from "vitest";

const FIXTURES = fileURLToPath(new URL("../fixtures/", import.meta.url));
const VERDICT = { works: "passed", partial: "partial", fails: "failed" } as const;

const manifests = (await readdir(FIXTURES, { withFileTypes: true, recursive: true }))
  .filter((e) => e.isFile() && e.name === "fixture.json")
  .map((e) => join(e.parentPath, e.name))
  .sort();

/** Opens every fixture offline in a real browser and compares the verdict with `expected.offline`. */
describe.skipIf((await findBrowser()) === null)("offline corpus", () => {
  // Fixtures are trusted test files. CI runners without a browser sandbox run without it.
  let options: VerifyOptions = { settleMs: 500 };
  beforeAll(async () => {
    const [first] = manifests;
    const m = FixtureManifest.parse(JSON.parse(await readFile(first as string, "utf8")));
    const probe = await verifyFile(join(dirname(first as string), m.artifact.path), options);
    if (probe.findings.some((f) => f.code === "verify.launch-failed") && process.env.CI) {
      options = { ...options, noSandbox: true };
    }
  });

  it.each(manifests.map((m) => [m.slice(FIXTURES.length), m]))(
    "%s",
    async (_label, path) => {
      const manifest = FixtureManifest.parse(JSON.parse(await readFile(path, "utf8")));
      const expected = manifest.expected.offline;
      if (expected === "not-tested") return;
      const result = await verifyFile(join(dirname(path), manifest.artifact.path), options);
      expect(result.verdict, JSON.stringify(result.browser)).toBe(VERDICT[expected]);
    },
    30_000,
  );
});
