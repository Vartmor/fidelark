import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectBytes } from "@fidelark/core";
import { FixtureManifest } from "@fidelark/schema";
import { describe, expect, it } from "vitest";

const FIXTURES = fileURLToPath(new URL("../fixtures/", import.meta.url));

async function findManifests(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name === "fixture.json")
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

const manifests = await findManifests(FIXTURES);

describe("fixture corpus", () => {
  it("contains at least one fixture", () => {
    expect(manifests.length).toBeGreaterThan(0);
  });

  it("has unique ids", async () => {
    const ids = await Promise.all(
      manifests.map(async (m) => JSON.parse(await readFile(m, "utf8")).id as string),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(manifests.map((m) => [m.slice(FIXTURES.length), m]))("%s", async (_label, path) => {
    const manifest = FixtureManifest.parse(JSON.parse(await readFile(path, "utf8")));
    const dir = dirname(path);
    expect(manifest.id, "id must match the directory name").toBe(basename(dir));

    const bytes = await readFile(join(dir, manifest.artifact.path));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    expect(sha256, "artifact hash must match the manifest").toBe(manifest.artifact.sha256);

    const report = inspectBytes(manifest.artifact.path, bytes);
    expect(report.input.format).toBe(manifest.expected.format);
  });
});
