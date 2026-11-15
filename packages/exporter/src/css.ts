import { CSS_FONT_FACE, CSS_URL, cssUrlOf, insideRanges } from "@fidelark/analyzer";
import type { ExportContext, Order } from "./context.ts";
import { dataUri, decodeText } from "./mime.ts";
import { resolveReference } from "./resolve.ts";
import { spliceAll } from "./splice.ts";

const MAX_IMPORT_DEPTH = 4;

type Edit = { start: number; end: number; text: Promise<string> };

async function applyEdits(source: string, edits: Edit[]): Promise<string> {
  const resolved = await Promise.all(edits.map(async (e) => ({ ...e, text: await e.text })));
  return spliceAll(source, resolved);
}

/**
 * `@import url(x) conditions;` or `@import "x" conditions;`. Like the analyzer's patterns, no
 * part can run past the next construct (conditions stop at `@` and quotes), so a stylesheet full
 * of unterminated imports is still scanned in linear time.
 */
const IMPORT =
  /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^"'()\s]+))\s*\)|"([^"]*)"|'([^']*)')([^;{}@"']*);/gi;

const isLocalOnly = (spec: string) => /^\s*(data:|#|$)/i.test(spec);

/**
 * Embeds what a stylesheet references: `@import`ed sheets (recursively, wrapped in `@media`
 * when they had a media list) and every `url()` as a data URI. References that cannot be
 * embedded are left unchanged and recorded as skipped.
 */
export async function inlineCss(
  css: string,
  base: URL,
  ctx: ExportContext,
  order: Order,
  depth = 0,
): Promise<string> {
  const edits: Edit[] = [];
  const taken: [number, number][] = [];
  const fontBlocks = [...css.matchAll(CSS_FONT_FACE)].map(
    (m) => [m.index, m.index + m[0].length] as const,
  );

  for (const m of css.matchAll(IMPORT)) {
    const spec = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "").trim();
    const conditions = (m[6] ?? "").trim();
    const range: [number, number] = [m.index, m.index + m[0].length];
    taken.push(range);
    if (/\b(layer|supports)\s*\(/i.test(conditions) || /^layer\b/i.test(conditions)) {
      ctx.skip("stylesheet", spec, "@import with layer() or supports() is not bundled yet", false, [
        ...order,
        m.index,
      ]);
      continue;
    }
    const url = resolveReference(spec, base, ctx.root);
    if (url === null) continue;
    if (depth >= MAX_IMPORT_DEPTH) {
      ctx.skip("stylesheet", spec, "@import nested too deeply", true, [...order, m.index]);
      continue;
    }
    edits.push({
      start: range[0],
      end: range[1],
      text: (async () => {
        const at = [...order, m.index];
        const res = await ctx.embed("stylesheet", spec, url, at);
        if (!res) return m[0];
        const inner = (await inlineCss(decodeText(res.bytes), res.url, ctx, at, depth + 1)).replace(
          /@charset\s+["'][^"']*["']\s*;/gi,
          "",
        );
        return conditions ? `@media ${conditions} {\n${inner}\n}` : inner;
      })(),
    });
  }

  const inImport = insideRanges(taken);
  const inFontFace = insideRanges(fontBlocks);
  for (const m of css.matchAll(CSS_URL)) {
    const at = m.index;
    if (inImport(at)) continue;
    const spec = cssUrlOf(m);
    if (isLocalOnly(spec)) continue;
    const url = resolveReference(spec, base, ctx.root);
    if (url === null) continue;
    const kind = inFontFace(at) ? "font" : "image";
    edits.push({
      start: at,
      end: at + m[0].length,
      text: (async () => {
        const res = await ctx.embed(kind, spec, url, [...order, at]);
        return res ? `url("${dataUri(res.mediaType, res.bytes)}")` : m[0];
      })(),
    });
  }
  return applyEdits(css, edits);
}
