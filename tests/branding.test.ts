import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { FIDELITY_CLASSES } from "@fidelark/schema";
import { describe, expect, it } from "vitest";
import { fidelarkColors, fidelarkFidelityClasses } from "../branding/tokens/brand.ts";

const BRANDING = fileURLToPath(new URL("../branding/", import.meta.url));
const read = (path: string) => readFile(join(BRANDING, path), "utf8");

async function listFiles(ext: string): Promise<string[]> {
  const entries = await readdir(BRANDING, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(ext))
    .map((e) => relative(BRANDING, join(e.parentPath, e.name)))
    .sort();
}

const manifest = (await read("quality/asset-manifest.sha256"))
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    if (!match) throw new Error(`Malformed manifest line: ${line}`);
    return [match[2] as string, match[1] as string] as const;
  });

describe("brand asset manifest", () => {
  it.each(manifest)("%s matches its recorded SHA-256", async (path, expected) => {
    const bytes = await readFile(join(BRANDING, path));
    const actual = createHash("sha256").update(bytes).digest("hex");
    expect(
      actual,
      "asset changed: run branding/scripts/verify_brand.py and update the manifest",
    ).toBe(expected);
  });
});

const svgs = await listFiles(".svg");

describe("brand SVG safety", () => {
  it.each(svgs)("%s contains no active or remote content", async (path) => {
    const svg = await read(path);
    expect(svg).toMatch(/<svg\b[^>]*\bviewBox=/);
    expect(svg).not.toMatch(/<\s*(script|foreignObject)\b/i);
    expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
    expect(svg).not.toMatch(/href\s*=\s*["']\s*(https?:|javascript:|\/\/)/i);
  });
});

describe("brand tokens", () => {
  it("TypeScript, DTCG JSON and CSS tokens agree on every color", async () => {
    const dtcg = JSON.parse(await read("tokens/colors.tokens.json")) as {
      color: Record<string, { $value: string }>;
    };
    const css = await read("tokens/brand.css");
    const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

    expect(Object.keys(dtcg.color).sort()).toEqual(Object.keys(fidelarkColors).sort());
    for (const [name, hex] of Object.entries(fidelarkColors)) {
      expect(dtcg.color[name]?.$value.toUpperCase(), name).toBe(hex.toUpperCase());
      expect(css, name).toMatch(new RegExp(`--f-${kebab(name)}:\\s*${hex};`, "i"));
    }
  });

  it("uses the same fidelity classes as the report schema", () => {
    expect([...fidelarkFidelityClasses]).toEqual([...FIDELITY_CLASSES]);
  });

  it("web manifest colors come from the tokens", async () => {
    const webmanifest = JSON.parse(await read("assets/favicon/site.webmanifest"));
    expect(webmanifest.theme_color).toBe(fidelarkColors.inkDeep);
    expect(webmanifest.background_color).toBe(fidelarkColors.paper);
  });
});

/** WCAG 2.2 relative luminance of an sRGB hex color. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const audit = JSON.parse(await read("quality/contrast-audit.json")) as {
  results: {
    pair: string;
    foreground: string;
    background: string;
    ratio: number;
    target: number;
  }[];
};

describe("contrast audit", () => {
  it.each(audit.results.map((r) => [r.pair, r] as const))(
    "%s: recorded ratio is correct and meets its target",
    (_pair, row) => {
      const ratio = contrast(row.foreground, row.background);
      expect(ratio).toBeCloseTo(row.ratio, 2);
      expect(ratio).toBeGreaterThanOrEqual(row.target);
    },
  );
});
