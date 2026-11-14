import type { ExportContext, Order } from "./context.ts";
import { dataUri, decodeText } from "./mime.ts";
import { resolveReference } from "./resolve.ts";

const MAX_IMPORT_DEPTH = 4;

type Edit = { start: number; end: number; text: Promise<string> };

async function applyEdits(source: string, edits: Edit[]): Promise<string> {
  const resolved = await Promise.all(edits.map(async (e) => ({ ...e, text: await e.text })));
  let out = source;
  for (const e of resolved.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

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
  const fontBlocks = [...css.matchAll(/@font-face\s*\{[^}]*\}/gi)].map(
    (m) => [m.index, m.index + m[0].length] as const,
  );

  for (const m of css.matchAll(
    /@import\s+(?:url\(\s*(["']?)([^"')]+)\1\s*\)|(["'])([^"']+)\3)\s*([^;]*);/gi,
  )) {
    const spec = (m[2] ?? m[4] ?? "").trim();
    const conditions = (m[5] ?? "").trim();
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

  for (const m of css.matchAll(/url\(\s*(["']?)([^"')]+?)\1\s*\)/gi)) {
    const at = m.index;
    if (taken.some(([s, e]) => at >= s && at < e)) continue;
    const spec = (m[2] ?? "").trim();
    if (isLocalOnly(spec)) continue;
    const url = resolveReference(spec, base, ctx.root);
    if (url === null) continue;
    const kind = fontBlocks.some(([s, e]) => at >= s && at < e) ? "font" : "image";
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
