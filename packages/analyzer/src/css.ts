import { lineLookup } from "./text.ts";

export type CssReference = {
  url: string;
  kind: "stylesheet" | "font" | "image";
  line: number;
};

/** Blanks out comments while keeping line breaks, so reported line numbers stay correct. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

/**
 * Extracts external references from CSS: `@import` (stylesheet), `url()` inside
 * `@font-face` (font) and every other `url()` (image). Never fetches anything.
 */
export function extractCssReferences(css: string, startLine = 1): CssReference[] {
  const text = stripComments(css);
  const lineOf = lineLookup(text, startLine);
  const refs: CssReference[] = [];
  const consumed: [number, number][] = [];

  for (const match of text.matchAll(/@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1\s*\)?/gi)) {
    refs.push({ url: match[2] ?? "", kind: "stylesheet", line: lineOf(match.index) });
    consumed.push([match.index, match.index + match[0].length]);
  }

  const fontBlocks: [number, number][] = [];
  for (const match of text.matchAll(/@font-face\s*\{[^}]*\}/gi)) {
    fontBlocks.push([match.index, match.index + match[0].length]);
  }

  for (const match of text.matchAll(/url\(\s*(["']?)([^"')]+?)\1\s*\)/gi)) {
    const at = match.index;
    if (consumed.some(([s, e]) => at >= s && at < e)) continue;
    const inFontFace = fontBlocks.some(([s, e]) => at >= s && at < e);
    refs.push({
      url: (match[2] ?? "").trim(),
      kind: inFontFace ? "font" : "image",
      line: lineOf(at),
    });
  }
  return refs.filter((ref) => ref.url !== "").sort((a, b) => a.line - b.line);
}

export function hasFontFace(css: string): boolean {
  return /@font-face\b/i.test(stripComments(css));
}
