import type { Capability, DependencyKind } from "@fidelark/schema";
import { type DefaultTreeAdapterTypes, parse } from "parse5";
import { extractCssReferences, hasFontFace } from "./css.ts";
import { isJavascriptUrl, srcsetUrls } from "./urls.ts";

type Element = DefaultTreeAdapterTypes.Element;
type ChildNode = DefaultTreeAdapterTypes.ChildNode;
type ParentNode = DefaultTreeAdapterTypes.ParentNode;

export type RawReference = {
  kind: DependencyKind;
  specifier: string;
  /** Resolve bare names as module specifiers rather than relative paths. */
  module: boolean;
  evidence: string;
};

export type InlineCode = {
  code: string;
  module: boolean;
  /** JSX/TypeScript for in-browser compilers; parsed with fallback rules. */
  compiled: boolean;
  startLine: number;
  label: string;
};

export type HtmlFacts = {
  references: RawReference[];
  inlineCode: InlineCode[];
  capabilities: Set<Capability>;
  inlineScripts: number;
  externalScripts: number;
  eventHandlers: number;
  javascriptUrls: number;
  staticTextChars: number;
  remoteForms: string[];
  metaRefresh: string[];
  baseHref: string | null;
  importMap: Map<string, string>;
};

const CLASSIC_TYPES = new Set([
  "",
  "text/javascript",
  "application/javascript",
  "text/ecmascript",
  "application/ecmascript",
  "text/jscript",
]);
const COMPILED_TYPES = new Set(["text/babel", "text/jsx", "text/typescript", "text/tsx"]);
const NON_RENDERED = new Set(["script", "style", "template", "noscript"]);
const URL_ATTRIBUTES = new Set(["href", "src", "action", "formaction", "data", "xlink:href"]);
const WEB_FONT_HOSTS =
  /\/\/(?:fonts\.googleapis\.com|fonts\.bunny\.net|use\.typekit\.net|fonts\.cdnfonts\.com)\b/i;
const SVG_NS = "http://www.w3.org/2000/svg";

const attr = (el: Element, name: string): string | undefined =>
  el.attrs.find((a) => a.name === name)?.value;

const lineOf = (el: Element): number => el.sourceCodeLocation?.startLine ?? 0;

/** Line where an element's content starts (after its start tag). */
const contentLine = (el: Element): number =>
  el.sourceCodeLocation?.startTag?.endLine ?? el.sourceCodeLocation?.startLine ?? 1;

const textContent = (el: Element): string =>
  el.childNodes
    .map((c) => (c.nodeName === "#text" ? (c as DefaultTreeAdapterTypes.TextNode).value : ""))
    .join("");

function isRemote(value: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(value.trim());
}

/** Parses HTML like a browser would (parse5) and collects facts. Executes and fetches nothing. */
export function extractHtml(html: string): HtmlFacts {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const facts: HtmlFacts = {
    references: [],
    inlineCode: [],
    capabilities: new Set<Capability>(["html"]),
    inlineScripts: 0,
    externalScripts: 0,
    eventHandlers: 0,
    javascriptUrls: 0,
    staticTextChars: 0,
    remoteForms: [],
    metaRefresh: [],
    baseHref: null,
    importMap: new Map(),
  };

  const addRef = (
    kind: DependencyKind,
    specifier: string | undefined,
    evidence: string,
    module = false,
  ) => {
    if (specifier === undefined || specifier.trim() === "") return;
    facts.references.push({ kind, specifier: specifier.trim(), module, evidence });
  };

  const addCss = (css: string, startLine: number, label: string) => {
    facts.capabilities.add("css");
    if (hasFontFace(css)) facts.capabilities.add("web-font");
    for (const ref of extractCssReferences(css, startLine)) {
      addRef(ref.kind, ref.url, `${label} line ${ref.line}`);
      if (ref.kind === "image") facts.capabilities.add("image");
    }
  };

  const visitElement = (el: Element, inBody: boolean, parent: Element | null) => {
    const tag = el.tagName.toLowerCase();
    const line = lineOf(el);

    for (const { name, value } of el.attrs) {
      if (name.startsWith("on") && name.length > 2) {
        facts.eventHandlers++;
        facts.capabilities.add("inline-script");
        facts.inlineCode.push({
          code: value,
          module: false,
          compiled: false,
          startLine: line,
          label: `${name} handler`,
        });
      } else if (URL_ATTRIBUTES.has(name) && isJavascriptUrl(value)) {
        facts.javascriptUrls++;
        facts.capabilities.add("inline-script");
        const code = value.replace(/^\s*javascript:/i, "");
        facts.inlineCode.push({
          code,
          module: false,
          compiled: false,
          startLine: line,
          label: `javascript: URL`,
        });
      } else if (name === "style" && value.trim() !== "") {
        addCss(value, line, "style attribute");
      }
    }

    switch (tag) {
      case "script": {
        const type = (attr(el, "type") ?? "").trim().toLowerCase();
        const src = attr(el, "src") ?? attr(el, "href") ?? attr(el, "xlink:href");
        const module = type === "module";
        if (type === "importmap") {
          facts.capabilities.add("module-script");
          readImportMap(textContent(el), line, facts, addRef);
          break;
        }
        const executable = CLASSIC_TYPES.has(type) || module || COMPILED_TYPES.has(type);
        if (!executable) break; // data blocks (JSON, templates) are not executed
        if (module) facts.capabilities.add("module-script");
        if (src !== undefined) {
          facts.externalScripts++;
          facts.capabilities.add("external-script");
          // src is a URL, not a module specifier, so "app.js" is a relative path, never bare.
          addRef(module ? "module" : "script", src, `<script src> line ${line}`);
        } else {
          const code = textContent(el);
          if (code.trim() === "") break;
          facts.inlineScripts++;
          facts.capabilities.add("inline-script");
          facts.inlineCode.push({
            code,
            module,
            compiled: COMPILED_TYPES.has(type),
            startLine: contentLine(el),
            label: `<script${type ? ` type="${type}"` : ""}>`,
          });
        }
        break;
      }
      case "style":
        addCss(textContent(el), contentLine(el), "<style>");
        break;
      case "link": {
        const rel = (attr(el, "rel") ?? "").toLowerCase().split(/\s+/);
        const href = attr(el, "href");
        const as = (attr(el, "as") ?? "").toLowerCase();
        const evidence = `<link rel="${rel.join(" ")}"> line ${line}`;
        if (rel.includes("stylesheet")) {
          facts.capabilities.add("css");
          if (href && WEB_FONT_HOSTS.test(href)) facts.capabilities.add("web-font");
          addRef("stylesheet", href, evidence);
        } else if (rel.includes("modulepreload")) addRef("module", href, evidence);
        else if (rel.includes("preload") || rel.includes("prefetch")) {
          const kind: DependencyKind =
            as === "font"
              ? "font"
              : as === "style"
                ? "stylesheet"
                : as === "script"
                  ? "script"
                  : as === "image"
                    ? "image"
                    : "other";
          if (kind === "font") facts.capabilities.add("web-font");
          addRef(kind, href, evidence);
        } else if (rel.some((r) => r === "icon" || r === "apple-touch-icon" || r === "mask-icon")) {
          addRef("image", href, evidence);
        } else if (rel.includes("manifest")) addRef("other", href, evidence);
        break;
      }
      case "img":
      case "input": {
        if (tag === "input" && (attr(el, "type") ?? "").toLowerCase() !== "image") break;
        facts.capabilities.add("image");
        addRef("image", attr(el, "src"), `<${tag} src> line ${line}`);
        for (const url of srcsetUrls(attr(el, "srcset") ?? ""))
          addRef("image", url, `<${tag} srcset> line ${line}`);
        break;
      }
      case "source": {
        const parentTag = parent?.tagName.toLowerCase();
        const kind: DependencyKind = parentTag === "picture" ? "image" : "media";
        addRef(kind, attr(el, "src"), `<source src> line ${line}`);
        for (const url of srcsetUrls(attr(el, "srcset") ?? ""))
          addRef(kind, url, `<source srcset> line ${line}`);
        break;
      }
      case "video":
      case "audio":
        facts.capabilities.add("media");
        addRef("media", attr(el, "src"), `<${tag} src> line ${line}`);
        addRef("image", attr(el, "poster"), `<${tag} poster> line ${line}`);
        break;
      case "track":
        addRef("media", attr(el, "src"), `<track src> line ${line}`);
        break;
      case "iframe":
      case "frame":
      case "embed":
      case "object": {
        facts.capabilities.add("iframe");
        const src = tag === "object" ? attr(el, "data") : attr(el, "src");
        if (src && !/^\s*about:/i.test(src)) addRef("frame", src, `<${tag}> line ${line}`);
        break;
      }
      case "form": {
        facts.capabilities.add("form");
        const action = attr(el, "action");
        if (action && isRemote(action))
          facts.remoteForms.push(`<form action="${action}"> line ${line}`);
        break;
      }
      case "canvas":
        facts.capabilities.add("canvas");
        break;
      case "meta": {
        if ((attr(el, "http-equiv") ?? "").toLowerCase() === "refresh") {
          facts.metaRefresh.push(
            `<meta http-equiv="refresh" content="${attr(el, "content") ?? ""}"> line ${line}`,
          );
        }
        break;
      }
      case "base":
        facts.baseHref = attr(el, "href") ?? null;
        break;
    }

    if (el.namespaceURI === SVG_NS) {
      if (tag === "svg") facts.capabilities.add("svg");
      if (tag === "image" || tag === "use" || tag === "feimage") {
        const href = attr(el, "href") ?? attr(el, "xlink:href");
        if (href && !href.startsWith("#")) addRef("image", href, `<svg ${tag}> line ${line}`);
      }
    }

    visitChildren(el, inBody || tag === "body", el);
  };

  const visitChildren = (node: ParentNode, inBody: boolean, parent: Element | null) => {
    for (const child of node.childNodes as ChildNode[]) {
      if (child.nodeName === "#text") {
        const tag = parent?.tagName.toLowerCase() ?? "";
        if (inBody && !NON_RENDERED.has(tag)) {
          facts.staticTextChars += (child as DefaultTreeAdapterTypes.TextNode).value.replace(
            /\s+/g,
            "",
          ).length;
        }
      } else if ("tagName" in child) {
        // Template content is inert until cloned by script, so it is not inspected.
        visitElement(child as Element, inBody, parent);
      }
    }
  };

  visitChildren(document, false, null);
  return facts;
}

function readImportMap(
  json: string,
  line: number,
  facts: HtmlFacts,
  addRef: (kind: DependencyKind, specifier: string, evidence: string, module?: boolean) => void,
) {
  let map: { imports?: Record<string, unknown>; scopes?: Record<string, Record<string, unknown>> };
  try {
    map = JSON.parse(json);
  } catch {
    return;
  }
  const entries = [
    ...Object.entries(map.imports ?? {}),
    ...Object.values(map.scopes ?? {}).flatMap((scope) => Object.entries(scope ?? {})),
  ];
  for (const [name, target] of entries) {
    if (typeof target !== "string") continue;
    facts.importMap.set(name, target);
    addRef("module", target, `<script type="importmap"> line ${line}`, true);
  }
}
