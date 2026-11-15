import { lineLookup } from "./text.ts";

export type CssReference = {
  url: string;
  kind: "stylesheet" | "font" | "image";
  line: number;
};

/**
 * Blanks out comments while keeping line breaks, so reported line numbers stay correct.
 * A scan with indexOf, so an unclosed comment costs one pass, not one pass per comment start.
 */
function stripComments(css: string): string {
  const parts: string[] = [];
  let at = 0;
  for (let open = css.indexOf("/*"); open !== -1; open = css.indexOf("/*", at)) {
    const close = css.indexOf("*/", open + 2);
    const end = close === -1 ? css.length : close + 2;
    parts.push(css.slice(at, open), css.slice(open, end).replace(/[^\n]/g, " "));
    at = end;
  }
  parts.push(css.slice(at));
  return parts.join("");
}

/**
 * Patterns shared with the exporter. They are written so that input with many unclosed
 * constructs (`url(` without `)`, `@font-face {` without `}`) is still scanned in linear time:
 * no part can run past the start of the next construct.
 */
export const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^"'()\s]+))\s*\)/gi;
export const CSS_FONT_FACE = /@font-face\s*\{[^{}]*\}/gi;

/**
 * Returns a test for "is this offset inside one of these ranges?" for sorted, non-overlapping
 * ranges and non-decreasing offsets (as matchAll yields them): one pass, not one per query.
 */
export function insideRanges(ranges: readonly (readonly [number, number])[]) {
  let i = 0;
  return (at: number): boolean => {
    while (i < ranges.length && (ranges[i] as readonly [number, number])[1] <= at) i++;
    const range = ranges[i];
    return range !== undefined && at >= range[0] && at < range[1];
  };
}

/** The URL inside a CSS_URL match. */
export const cssUrlOf = (m: RegExpMatchArray) => (m[1] ?? m[2] ?? m[3] ?? "").trim();

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
  for (const match of text.matchAll(CSS_FONT_FACE)) {
    fontBlocks.push([match.index, match.index + match[0].length]);
  }

  const inImport = insideRanges(consumed);
  const inFontFaceBlock = insideRanges(fontBlocks);
  for (const match of text.matchAll(CSS_URL)) {
    const at = match.index;
    if (inImport(at)) continue;
    const inFontFace = inFontFaceBlock(at);
    refs.push({
      url: cssUrlOf(match),
      kind: inFontFace ? "font" : "image",
      line: lineOf(at),
    });
  }
  return refs.filter((ref) => ref.url !== "").sort((a, b) => a.line - b.line);
}

export function hasFontFace(css: string): boolean {
  return /@font-face\b/i.test(stripComments(css));
}
