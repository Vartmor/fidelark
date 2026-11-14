import { type Node as AcornNode, type Expression, parse } from "acorn";
import { simple } from "acorn-walk";
import { lineLookup } from "./text.ts";

/** A reference found in code. `target` is null when it is computed at runtime. */
export type CodeReference = {
  target: string | null;
  line: number;
  via: string;
};

export type ScriptFacts = {
  /** False when the code could not be parsed (e.g. JSX for in-browser Babel); regex rules were used. */
  parsed: boolean;
  network: CodeReference[];
  websockets: CodeReference[];
  staticImports: CodeReference[];
  dynamicImports: CodeReference[];
  workers: CodeReference[];
  storage: CodeReference[];
  dynamicCode: CodeReference[];
  scriptInjection: CodeReference[];
  hostApi: CodeReference[];
};

const emptyFacts = (parsed: boolean): ScriptFacts => ({
  parsed,
  network: [],
  websockets: [],
  staticImports: [],
  dynamicImports: [],
  workers: [],
  storage: [],
  dynamicCode: [],
  scriptInjection: [],
  hostApi: [],
});

const FETCH = new Set(["fetch", "window.fetch", "globalThis.fetch", "self.fetch"]);
const STORAGE = new Set(["localStorage", "sessionStorage", "indexedDB"]);
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

type AnyNode = AcornNode & Record<string, unknown>;

/** Dotted name of an identifier or non-computed member chain, e.g. "navigator.sendBeacon". */
function dottedName(node: unknown): string | null {
  const n = node as AnyNode | undefined;
  if (!n) return null;
  if (n.type === "Identifier") return n.name as string;
  if (n.type === "ThisExpression") return "this";
  if (n.type === "MemberExpression" && !n.computed) {
    const object = dottedName(n.object);
    const property = (n.property as AnyNode).name as string | undefined;
    return object && property ? `${object}.${property}` : null;
  }
  return null;
}

/**
 * The static part of a string expression: literals, template literals and `"literal" + x`.
 * Computed parts become "…", so `https://api.example.com/${id}` stays recognizably remote.
 */
function staticString(node: unknown): string | null {
  const n = node as AnyNode | undefined;
  if (!n) return null;
  if (n.type === "Literal" && typeof n.value === "string") return n.value;
  if (n.type === "TemplateLiteral") {
    const quasis = n.quasis as { value: { cooked?: string | null } }[];
    const parts = quasis.map((q) => q.value.cooked ?? "");
    if (parts.length === 1) return parts[0] ?? "";
    const joined = parts.join("…");
    return joined.replace(/…+$/, "…") || null;
  }
  if (n.type === "BinaryExpression" && n.operator === "+") {
    const left = staticString(n.left);
    return left ? `${left}…` : null;
  }
  return null;
}

function tryParse(code: string, module: boolean) {
  const sourceTypes = module ? (["module"] as const) : (["script", "module"] as const);
  for (const sourceType of sourceTypes) {
    try {
      return parse(code, {
        ecmaVersion: "latest",
        sourceType,
        locations: true,
        allowHashBang: true,
        allowReturnOutsideFunction: sourceType === "script",
        allowAwaitOutsideFunction: true,
      });
    } catch {
      // Try the next source type, then fall back to regex rules.
    }
  }
  return null;
}

/**
 * Collects network, storage, module and host-API usage from JavaScript without executing it.
 * `startLine` is the line in the HTML document where the code begins.
 */
export function analyzeScript(code: string, { module = false, startLine = 1 } = {}): ScriptFacts {
  const ast = tryParse(code, module);
  if (!ast) return analyzeWithRegex(code, startLine);

  const facts = emptyFacts(true);
  const lineOf = (node: AcornNode) => startLine + (node.loc?.start.line ?? 1) - 1;
  const ref = (target: string | null, node: AcornNode, via: string): CodeReference => ({
    target,
    line: lineOf(node),
    via,
  });

  simple(ast, {
    CallExpression(node) {
      const name = dottedName(node.callee);
      const [arg0, arg1] = node.arguments as Expression[];
      if (name === null) return;
      if (FETCH.has(name)) facts.network.push(ref(staticString(arg0), node, "fetch()"));
      else if (name.endsWith("navigator.sendBeacon") || name === "navigator.sendBeacon")
        facts.network.push(ref(staticString(arg0), node, "navigator.sendBeacon()"));
      else if (name.endsWith(".open") && HTTP_METHODS.has(String(staticString(arg0)).toUpperCase()))
        facts.network.push(ref(staticString(arg1), node, "XMLHttpRequest.open()"));
      else if (name === "eval" || name === "window.eval")
        facts.dynamicCode.push(ref(null, node, "eval()"));
      else if ((name === "setTimeout" || name === "setInterval") && staticString(arg0) !== null)
        facts.dynamicCode.push(ref(null, node, `${name}() with a string`));
      else if (name === "document.createElement" && staticString(arg0)?.toLowerCase() === "script")
        facts.scriptInjection.push(ref(null, node, 'document.createElement("script")'));
      else if (name === "importScripts")
        facts.workers.push(ref(staticString(arg0), node, "importScripts()"));
      else if (name.endsWith("serviceWorker.register"))
        facts.workers.push(ref(staticString(arg0), node, "serviceWorker.register()"));
    },
    NewExpression(node) {
      const name = dottedName(node.callee);
      const [arg0] = node.arguments as Expression[];
      if (name === "XMLHttpRequest") facts.network.push(ref(null, node, "XMLHttpRequest"));
      else if (name === "EventSource")
        facts.network.push(ref(staticString(arg0), node, "EventSource"));
      else if (name === "WebSocket")
        facts.websockets.push(ref(staticString(arg0), node, "WebSocket"));
      else if (name === "Function") facts.dynamicCode.push(ref(null, node, "new Function()"));
      else if (name === "Worker" || name === "SharedWorker")
        facts.workers.push(ref(staticString(arg0), node, `new ${name}()`));
    },
    ImportExpression(node) {
      facts.dynamicImports.push(ref(staticString(node.source), node, "import()"));
    },
    ImportDeclaration(node) {
      facts.staticImports.push(ref(String(node.source.value), node, "import"));
    },
    ExportNamedDeclaration(node) {
      if (node.source)
        facts.staticImports.push(ref(String(node.source.value), node, "export from"));
    },
    ExportAllDeclaration(node) {
      facts.staticImports.push(ref(String(node.source.value), node, "export * from"));
    },
    MemberExpression(node) {
      const name = dottedName(node);
      const object = dottedName(node.object);
      if (name === "window.claude" || object === "window.claude") {
        if (name === "window.claude") facts.hostApi.push(ref(null, node, "window.claude"));
        return;
      }
      if (name === "document.cookie") facts.storage.push(ref(null, node, "document.cookie"));
      else if (object !== null && STORAGE.has(object.replace(/^window\./, ""))) {
        facts.storage.push(ref(null, node, object.replace(/^window\./, "")));
      }
    },
  });

  // `xhr.open(method, url)` already names the request; drop the bare constructor then.
  if (facts.network.some((r) => r.via === "XMLHttpRequest.open()")) {
    facts.network = facts.network.filter((r) => r.via !== "XMLHttpRequest");
  }
  facts.network = dedupeRefs(facts.network);
  facts.storage = dedupeRefs(facts.storage);
  return facts;
}

/** Keeps one reference per (via, target, line), e.g. many `localStorage.x` reads on one line. */
function dedupeRefs(refs: CodeReference[]): CodeReference[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const key = `${r.via}|${r.target}|${r.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Simpler rules for code that is not plain JavaScript, such as JSX compiled in the browser. */
function analyzeWithRegex(code: string, startLine: number): ScriptFacts {
  const facts = emptyFacts(false);
  const lineOf = lineLookup(code, startLine);
  const collect = (pattern: RegExp, into: CodeReference[], via: string, group?: number) => {
    for (const match of code.matchAll(pattern)) {
      const target = group === undefined ? null : (match[group] ?? null);
      into.push({ target, line: lineOf(match.index), via });
    }
  };
  collect(/\bfetch\s*\(\s*(?:(["'`])([^"'`]*)\1)?/g, facts.network, "fetch()", 2);
  collect(/\bnew\s+XMLHttpRequest\b/g, facts.network, "XMLHttpRequest");
  collect(/\bnew\s+EventSource\s*\(\s*(?:(["'`])([^"'`]*)\1)?/g, facts.network, "EventSource", 2);
  collect(/\bnew\s+WebSocket\s*\(\s*(?:(["'`])([^"'`]*)\1)?/g, facts.websockets, "WebSocket", 2);
  collect(
    /\bnavigator\.sendBeacon\s*\(\s*(?:(["'`])([^"'`]*)\1)?/g,
    facts.network,
    "navigator.sendBeacon()",
    2,
  );
  collect(/\bimport\s*\(\s*(?:(["'`])([^"'`]*)\1)?/g, facts.dynamicImports, "import()", 2);
  collect(
    /^\s*(?:import|export)\s[^"'`;]*?\bfrom\s*(["'])([^"']+)\1/gm,
    facts.staticImports,
    "import",
    2,
  );
  collect(/^\s*import\s*(["'])([^"']+)\1/gm, facts.staticImports, "import", 2);
  collect(
    /\b(?:localStorage|sessionStorage|indexedDB)\b|\bdocument\.cookie\b/g,
    facts.storage,
    "storage",
  );
  collect(/\beval\s*\(|\bnew\s+Function\s*\(/g, facts.dynamicCode, "eval()");
  collect(/\bwindow\.claude\b/g, facts.hostApi, "window.claude");
  for (const r of facts.network) if (r.target === "") r.target = null;
  facts.network = dedupeRefs(facts.network);
  facts.storage = dedupeRefs(facts.storage);
  return facts;
}
