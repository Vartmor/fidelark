import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectBytes } from "@fidelark/core";
import { FIDELITY_DISPLAY, FixtureManifest } from "@fidelark/schema";
import { formatReport } from "../../../packages/cli/src/format.ts";

/** The repository fixtures the belt shows; the site plugin watches this folder in dev. */
export const FIXTURES = fileURLToPath(new URL("../../../fixtures/", import.meta.url));

/** Belt order: alternates outcomes so neighbouring cards tell different stories. */
export const BELT_ORDER = [
  "minimal-quiz",
  "live-data-widget",
  "remote-assets",
  "platform-host-api",
  "static-article",
  "react-babel-cdn",
  "missing-local-files",
  "form-exfiltration",
  "module-bare-import",
] as const;

export type SiteReport = {
  id: string;
  title: string;
  fidelity: string;
  glyph: string;
  label: string;
  dependencies: number;
  findings: number;
  /** Human-readable `fidelark inspect` output, exactly as the CLI prints it. */
  text: string;
};

export async function buildSiteReports(): Promise<SiteReport[]> {
  const entries = await readdir(FIXTURES, { withFileTypes: true, recursive: true });
  const manifests = entries
    .filter((e) => e.isFile() && e.name === "fixture.json")
    .map((e) => join(e.parentPath, e.name));
  const byId = new Map<string, SiteReport>();
  for (const path of manifests) {
    const manifest = FixtureManifest.parse(JSON.parse(await readFile(path, "utf8")));
    const bytes = await readFile(join(dirname(path), manifest.artifact.path));
    // A fixed clock keeps the file stable; generatedAt is not shown anyway.
    const report = inspectBytes(`${manifest.id}.html`, bytes, {
      now: () => new Date("2026-11-14T00:00:00.000Z"),
    });
    const overall = report.analysis?.fidelity.overall;
    if (!overall) continue;
    byId.set(manifest.id, {
      id: manifest.id,
      title: manifest.title,
      fidelity: overall,
      glyph: FIDELITY_DISPLAY[overall].glyph,
      label: FIDELITY_DISPLAY[overall].label,
      dependencies: report.analysis?.dependencies.length ?? 0,
      findings: report.findings.filter((f) => f.code !== "fidelity.unverified").length,
      text: formatReport(report),
    });
  }
  return BELT_ORDER.map((id) => {
    const report = byId.get(id);
    if (!report) throw new Error(`fixture ${id} is missing or not analyzed`);
    return report;
  });
}
