import { createHash } from "node:crypto";
import {
  type DependencyKind,
  type ExportManifest,
  type Finding,
  SCHEMA_VERSION,
} from "@fidelark/schema";
import { type DefaultTreeAdapterTypes, parse } from "parse5";
import { ExportContext, label, type Order } from "./context.ts";
import { inlineCss } from "./css.ts";
import type { Loader } from "./loader.ts";
import { dataUri, decodeText } from "./mime.ts";
import { resolveReference } from "./resolve.ts";
import { checkIntegrity } from "./sri.ts";

type Element = DefaultTreeAdapterTypes.Element;
type ParentNode = DefaultTreeAdapterTypes.ParentNode;

export type ExportOptions = {
  /** File name of the source, recorded in the manifest. */
  sourceName: string;
  /** Location of the source document; relative references resolve against it. */
  documentUrl: URL;
  /** Root for root-relative paths (`/img/a.png`); defaults to the document's directory. */
  rootUrl?: URL;
  loader: Loader;
  maxTotalBytes: number;
  toolVersion: string;
  now?: () => Date;
};

export type ExportResult = {
  html: string;
  manifest: ExportManifest;
  findings: Finding[];
};

export const MANIFEST_ID = "fidelark-export";

const CLASSIC_TYPES = new Set([
  "",
  "text/javascript",
  "application/javascript",
  "text/ecmascript",
  "application/ecmascript",
]);
const COMPILED_TYPES = new Set(["text/babel", "text/jsx", "text/typescript", "text/tsx"]);
const HINT_RELS = new Set(["preload", "prefetch", "preconnect", "dns-prefetch", "prerender"]);
const DROP_ON_INLINE = new Set([
  "src",
  "integrity",
  "crossorigin",
  "charset",
  "referrerpolicy",
  "fetchpriority",
]);

type Edit = { start: number; end: number; text: Promise<string> | string };

const attr = (el: Element, name: string) => el.attrs.find((a) => a.name === name)?.value;

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function serializeAttrs(el: Element, drop: Set<string>): string {
  return el.attrs
    .filter((a) => !drop.has(a.name))
    .map((a) => (a.value === "" ? ` ${a.name}` : ` ${a.name}="${escapeAttr(a.value)}"`))
    .join("");
}

/** Makes code safe to place inside a <script> element without ending it early. */
const escapeScript = (code: string) =>
  code.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
const escapeStyle = (css: string) => css.replace(/<\/(style)/gi, "<\\/$1");

/**
 * Bundles a single HTML document into one self-contained file. Scripts, stylesheets (with their
 * imports, fonts and images), images, icons and media become inline content or data URIs.
 * Frames, network endpoints and ES module graphs stay external and are recorded as skipped.
 * The source is only parsed and rewritten; nothing is executed.
 */
export async function exportStandaloneHtml(
  html: string,
  options: ExportOptions,
): Promise<ExportResult> {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const root = options.rootUrl ?? new URL(".", options.documentUrl);
  const ctx = new ExportContext(options.loader, options.maxTotalBytes, root);
  const edits: Edit[] = [];
  const notes = { hintsRemoved: 0, csp: false };
  let base = options.documentUrl;
  let head: Element | null = null;
  let body: Element | null = null;
  let previousManifest: Element | null = null;

  const resolve = (spec: string) => resolveReference(spec, base, root);
  // Document order of references, so manifests are deterministic (see Order).
  let position = 0;
  const next = (): Order => [position++];

  /** Replaces one attribute's value with the data URI of the resource it references. */
  const embedAttribute = (el: Element, name: string, kind: DependencyKind) => {
    const value = attr(el, name);
    const loc = el.sourceCodeLocation?.attrs?.[name];
    if (value === undefined || !loc) return;
    const url = resolve(value);
    if (url === null) return;
    const order = next();
    edits.push({
      start: loc.startOffset,
      end: loc.endOffset,
      text: ctx
        .embed(kind, value, url, order)
        .then((res) =>
          res
            ? `${name}="${dataUri(res.mediaType, res.bytes)}"`
            : html.slice(loc.startOffset, loc.endOffset),
        ),
    });
  };

  const embedSrcset = (el: Element, kind: DependencyKind) => {
    const value = attr(el, "srcset");
    const loc = el.sourceCodeLocation?.attrs?.srcset;
    if (value === undefined || !loc) return;
    const order = next();
    edits.push({
      start: loc.startOffset,
      end: loc.endOffset,
      text: (async () => {
        const parts = await Promise.all(
          value.split(/,(?=\s*\S)/).map(async (candidate, i) => {
            const [spec = "", ...descriptors] = candidate.trim().split(/\s+/);
            const url = resolve(spec);
            const res = url ? await ctx.embed(kind, spec, url, [...order, i]) : null;
            return [res ? dataUri(res.mediaType, res.bytes) : spec, ...descriptors].join(" ");
          }),
        );
        return `srcset="${escapeAttr(parts.join(", "))}"`;
      })(),
    });
  };

  const scriptElement = (el: Element) => {
    const loc = el.sourceCodeLocation;
    const type = (attr(el, "type") ?? "").trim().toLowerCase();
    const src = attr(el, "src");
    if (el.attrs.some((a) => a.name === "id" && a.value === MANIFEST_ID)) {
      previousManifest = el;
      return;
    }
    if (src === undefined || !loc?.startTag) return;
    if (type === "module") {
      ctx.skip("module", src, "ES module graphs are not bundled yet", false, next());
      return;
    }
    if (!CLASSIC_TYPES.has(type) && !COMPILED_TYPES.has(type)) return;
    const url = resolve(src);
    if (url === null) return;
    const deferred = attr(el, "defer") !== undefined || attr(el, "async") !== undefined;
    const end = loc.endTag?.endOffset ?? loc.startTag.endOffset;
    const order = next();
    edits.push({
      start: loc.startTag.startOffset,
      end,
      text: (async () => {
        const original = html.slice(loc.startTag?.startOffset ?? 0, end);
        const res = await ctx.embed("script", src, url, order);
        if (!res) return original;
        if (checkIntegrity(attr(el, "integrity"), res.bytes) === "mismatch") {
          ctx.reject(
            "script",
            src,
            "integrity check failed: content does not match the integrity attribute",
            order,
          );
          return original;
        }
        if (deferred && !COMPILED_TYPES.has(type)) {
          // Keeps defer/async semantics, which inline scripts do not have.
          const drop = new Set([...DROP_ON_INLINE].filter((n) => n !== "src"));
          const attrs = serializeAttrs(el, new Set([...drop, "src"]));
          return `<script src="${dataUri("text/javascript", res.bytes)}"${attrs}></script>`;
        }
        return `<script${serializeAttrs(el, DROP_ON_INLINE)}>${escapeScript(decodeText(res.bytes))}</script>`;
      })(),
    });
  };

  const linkElement = (el: Element) => {
    const loc = el.sourceCodeLocation;
    const rel = (attr(el, "rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const href = attr(el, "href");
    if (!loc || href === undefined) return;
    if (rel.includes("stylesheet") && !rel.includes("alternate")) {
      const url = resolve(href);
      if (url === null) return;
      const order = next();
      edits.push({
        start: loc.startOffset,
        end: loc.endOffset,
        text: (async () => {
          const original = html.slice(loc.startOffset, loc.endOffset);
          const res = await ctx.embed("stylesheet", href, url, order);
          if (!res) return original;
          if (checkIntegrity(attr(el, "integrity"), res.bytes) === "mismatch") {
            ctx.reject(
              "stylesheet",
              href,
              "integrity check failed: content does not match the integrity attribute",
              order,
            );
            return original;
          }
          const css = await inlineCss(decodeText(res.bytes), res.url, ctx, order);
          const media = attr(el, "media");
          return `<style${media ? ` media="${escapeAttr(media)}"` : ""}>${escapeStyle(css)}</style>`;
        })(),
      });
    } else if (rel.some((r) => r === "icon" || r === "apple-touch-icon" || r === "mask-icon")) {
      embedAttribute(el, "href", "image");
    } else if (rel.some((r) => HINT_RELS.has(r))) {
      // Resource hints only tell the browser what to fetch early; offline they just fail.
      notes.hintsRemoved++;
      edits.push({ start: loc.startOffset, end: loc.endOffset, text: "" });
    } else if (rel.includes("modulepreload")) {
      ctx.skip("module", href, "ES module graphs are not bundled yet", false, next());
    } else if (rel.includes("manifest")) {
      ctx.skip("other", href, "web app manifests are not bundled", false, next());
    }
  };

  const styleContent = (el: Element) => {
    const loc = el.sourceCodeLocation;
    if (!loc?.startTag || !loc.endTag) return;
    const start = loc.startTag.endOffset;
    const end = loc.endTag.startOffset;
    const css = html.slice(start, end);
    if (!/url\(|@import/i.test(css)) return;
    edits.push({ start, end, text: inlineCss(css, base, ctx, next()).then(escapeStyle) });
  };

  const styleAttribute = (el: Element) => {
    const value = attr(el, "style");
    const loc = el.sourceCodeLocation?.attrs?.style;
    if (value === undefined || !loc || !/url\(/i.test(value)) return;
    edits.push({
      start: loc.startOffset,
      end: loc.endOffset,
      text: inlineCss(value, base, ctx, next()).then((css) => `style="${escapeAttr(css)}"`),
    });
  };

  const visit = (node: ParentNode) => {
    for (const child of node.childNodes) {
      if (!("tagName" in child)) continue;
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (el.attrs.some((a) => a.name === "style")) styleAttribute(el);
      switch (tag) {
        case "head":
          head = el;
          break;
        case "body":
          body = el;
          break;
        case "base": {
          const href = attr(el, "href");
          if (href) base = resolveReference(href, options.documentUrl, root) ?? base;
          break;
        }
        case "meta":
          if ((attr(el, "http-equiv") ?? "").toLowerCase() === "content-security-policy")
            notes.csp = true;
          break;
        case "script":
          scriptElement(el);
          break;
        case "link":
          linkElement(el);
          break;
        case "style":
          styleContent(el);
          break;
        case "img":
          embedAttribute(el, "src", "image");
          embedSrcset(el, "image");
          break;
        case "input":
          if ((attr(el, "type") ?? "").toLowerCase() === "image")
            embedAttribute(el, "src", "image");
          break;
        case "source": {
          const kind: DependencyKind =
            (node as Element).tagName?.toLowerCase() === "picture" ? "image" : "media";
          embedAttribute(el, "src", kind);
          embedSrcset(el, kind);
          break;
        }
        case "video":
        case "audio":
          embedAttribute(el, "src", "media");
          embedAttribute(el, "poster", "image");
          break;
        case "track":
          embedAttribute(el, "src", "media");
          break;
        case "image":
        case "feimage":
          embedAttribute(el, "href", "image");
          embedAttribute(el, "xlink:href", "image");
          break;
        case "iframe":
        case "frame":
        case "embed":
        case "object": {
          const src = tag === "object" ? attr(el, "data") : attr(el, "src");
          if (src && resolve(src))
            ctx.skip("frame", src, "embedded pages stay external", false, next());
          break;
        }
      }
      visit(el); // template content lives in `content`, not childNodes, so it is not touched
    }
  };
  visit(document);

  const resolvedEdits = await Promise.all(edits.map(async (e) => ({ ...e, text: await e.text })));

  const sourceSha256 = createHash("sha256").update(html).digest("hex");
  const manifest: ExportManifest = {
    schemaVersion: SCHEMA_VERSION,
    tool: { name: "fidelark", version: options.toolVersion },
    exportedAt: (options.now ?? (() => new Date()))().toISOString(),
    source: { name: options.sourceName, sha256: sourceSha256 },
    bundled: ctx.bundled,
    skipped: ctx.skipped,
  };
  const manifestTag = `<script type="application/json" id="${MANIFEST_ID}">${JSON.stringify(manifest).replace(/</g, "\\u003c")}</script>`;

  const oldManifest = previousManifest as Element | null;
  const oldLoc = oldManifest?.sourceCodeLocation;
  if (oldLoc) {
    resolvedEdits.push({ start: oldLoc.startOffset, end: oldLoc.endOffset, text: manifestTag });
  } else {
    const at = insertionPoint(head, body);
    resolvedEdits.push({ start: at, end: at, text: at === 0 ? `${manifestTag}\n` : manifestTag });
  }

  let out = html;
  for (const e of resolvedEdits.sort((a, b) => b.start - a.start || b.end - a.end)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }

  return { html: out, manifest, findings: exportFindings(ctx, notes) };
}

/** Where the manifest goes: before </head>, else before <body>, else at the very start. */
function insertionPoint(head: Element | null, body: Element | null): number {
  const headEnd = head?.sourceCodeLocation?.endTag?.startOffset;
  if (headEnd !== undefined) return headEnd;
  const bodyStart = body?.sourceCodeLocation?.startTag?.startOffset;
  if (bodyStart !== undefined) return bodyStart;
  return 0;
}

function exportFindings(
  ctx: ExportContext,
  notes: { hintsRemoved: number; csp: boolean },
): Finding[] {
  const findings: Finding[] = [];
  const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
  if (ctx.bundled.length > 0) {
    const local = ctx.bundled.filter((b) => b.from === "local").length;
    findings.push({
      code: "export.bundled",
      severity: "info",
      message: `Embedded ${ctx.bundled.length} resource${ctx.bundled.length === 1 ? "" : "s"} (${kb(ctx.totalBytes)}): ${local} local, ${ctx.bundled.length - local} remote.`,
    });
  }
  const failed = ctx.skipped.filter((s) => s.failed);
  if (failed.length > 0) {
    findings.push({
      code: "export.failed",
      severity: "error",
      message: `${failed.length} resource${failed.length === 1 ? "" : "s"} could not be embedded; the original references were kept.`,
      evidence: failed.slice(0, 10).map((s) => `${s.kind}: ${s.specifier} — ${s.reason}`),
    });
  }
  const noNetwork = ctx.skipped.filter((s) => s.reason.startsWith("network access not allowed"));
  if (noNetwork.length > 0) {
    findings.push({
      code: "export.network-not-allowed",
      severity: "warning",
      message: `${noNetwork.length} remote resource${noNetwork.length === 1 ? " was" : "s were"} not downloaded because network access was not allowed. Run again with --allow-network to embed ${noNetwork.length === 1 ? "it" : "them"}.`,
      evidence: noNetwork.slice(0, 10).map((s) => `${s.kind}: ${s.specifier}`),
    });
  }
  const external = ctx.skipped.filter(
    (s) => !s.failed && !s.reason.startsWith("network access not allowed"),
  );
  if (external.length > 0) {
    findings.push({
      code: "export.external",
      severity: "info",
      message: `${external.length} reference${external.length === 1 ? " stays" : "s stay"} external by design.`,
      evidence: external.slice(0, 10).map((s) => `${s.kind}: ${s.specifier} — ${s.reason}`),
    });
  }
  if (notes.hintsRemoved > 0) {
    findings.push({
      code: "export.hints-removed",
      severity: "info",
      message: `Removed ${notes.hintsRemoved} resource hint${notes.hintsRemoved === 1 ? "" : "s"} (preload, prefetch, preconnect) that would only fail offline.`,
    });
  }
  if (notes.csp) {
    findings.push({
      code: "export.csp",
      severity: "warning",
      message:
        "The page declares a Content-Security-Policy; it may block the embedded scripts, styles or data URIs.",
    });
  }
  return findings.map((f) => (f.evidence ? { ...f, evidence: f.evidence.map(label) } : f));
}
