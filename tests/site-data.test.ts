import { readFile } from "node:fs/promises";
import { FIDELITY_CLASSES, FIDELITY_DISPLAY } from "@fidelark/schema";
import { describe, expect, it } from "vitest";
import { BELT_ORDER, buildSiteReports } from "../apps/site/scripts/site-reports.ts";
import reports from "../apps/site/src/data/reports.json" with { type: "json" };
import { CLI_URL, FIDELITY, FIXTURE_NAMES, ROADMAP_URL } from "../apps/site/src/lib/site.ts";

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

/** GitHub's heading anchor: lowercase, punctuation dropped, spaces to hyphens. */
const anchors = new Set(
  readme
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) =>
      line
        .slice(3)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/ /g, "-"),
    ),
);

describe("promo site data", () => {
  it("ships reports that match what the CLI prints for the fixtures today", async () => {
    // If this fails, run `pnpm site:data` and commit the regenerated file.
    expect(reports).toEqual(await buildSiteReports());
  });

  it("shows the same fidelity notation, in the same order, as @fidelark/schema", () => {
    expect(FIDELITY.map((f) => f.id)).toEqual([...FIDELITY_CLASSES]);
    for (const f of FIDELITY) {
      const { glyph, label, description } = FIDELITY_DISPLAY[f.id];
      expect({ glyph: f.glyph, label: f.label, description: f.description }).toEqual({
        glyph,
        label,
        description,
      });
    }
  });

  it("has a short name for every fixture on the belt", () => {
    expect(Object.keys(FIXTURE_NAMES).sort()).toEqual([...BELT_ORDER].sort());
  });

  it("links to README sections that exist", () => {
    for (const url of [CLI_URL, ROADMAP_URL]) {
      const anchor = new URL(url).hash.slice(1);
      expect(anchors, url).toContain(anchor);
    }
  });
});
