import {
  type Analysis,
  CAPABILITIES,
  type Capability,
  type Dependency,
  type DependencyKind,
  type Finding,
} from "@fidelark/schema";
import { extractCssReferences, hasFontFace } from "./css.ts";
import { assessFidelity } from "./fidelity.ts";
import { extractHtml, type RawReference } from "./html.ts";
import { type LocalFiles, resolveLocalPath } from "./local.ts";
import { analyzeScript, type CodeReference, type ScriptFacts } from "./script.ts";
import { findSecrets, redactSecrets } from "./secrets.ts";
import { capList, plural, truncate } from "./text.ts";
import { classifySpecifier } from "./urls.ts";

export type AnalysisResult = {
  analysis: Analysis;
  findings: Finding[];
};

const show = (target: string | null) =>
  target === null ? "computed at runtime" : truncate(redactSecrets(target));
const where = (r: CodeReference) => `${r.via} line ${r.line}`;

/** A reference plus, inside an archive, the file it was written in and the file it names. */
type SourcedReference = RawReference & {
  /** Archive path the reference resolves against. */
  base?: string;
  /** Archive path of the file it names, when that file is in the archive. */
  path?: string;
};

/** Merges references to the same resource and classifies where each one lives. */
function buildDependencies(refs: SourcedReference[], importMap: Map<string, string>): Dependency[] {
  const byKey = new Map<string, Dependency>();
  for (const ref of refs) {
    const location = classifySpecifier(ref.specifier, { module: ref.module });
    if (location === null) continue;
    if (location === "bare" && resolvesThroughImportMap(ref.specifier, importMap)) continue;
    const specifier = truncate(redactSecrets(ref.specifier));
    // Inside an archive, the same name in two folders is two files.
    const key = `${ref.kind}|${ref.path ?? specifier}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.evidence.includes(ref.evidence)) existing.evidence.push(ref.evidence);
      continue;
    }
    byKey.set(key, {
      kind: ref.kind,
      specifier,
      location,
      bundled: location === "embedded" || ref.path !== undefined,
      evidence: [ref.evidence],
    });
  }
  return [...byKey.values()];
}

/**
 * References made by code. Imports resolve against the file that contains them; workers and
 * network requests resolve against the document, as in a browser.
 */
function codeReferences(
  code: ScriptFacts,
  codeBase: string | undefined,
  documentBase: string | undefined,
): SourcedReference[] {
  const refs: SourcedReference[] = [];
  const add = (
    list: CodeReference[],
    kind: DependencyKind,
    module: boolean,
    base: string | undefined,
  ) => {
    for (const r of list) {
      if (r.target !== null && r.target !== "")
        refs.push({ kind, specifier: r.target, module, evidence: where(r), base });
    }
  };
  add(code.staticImports, "module", true, codeBase);
  add(code.dynamicImports, "module", true, codeBase);
  add(code.workers, "script", false, documentBase);
  add(code.network, "network", false, documentBase);
  add(code.websockets, "network", false, documentBase);
  return refs;
}

/** Names the archive file in every reference found in its code, e.g. `fetch() in app.js`. */
function inFile(facts: ScriptFacts, path: string): ScriptFacts {
  const out = { ...facts };
  for (const key of Object.keys(out) as (keyof ScriptFacts)[]) {
    if (key === "parsed") continue;
    (out[key] as CodeReference[]) = (facts[key] as CodeReference[]).map((r) => ({
      ...r,
      via: `${r.via} in ${path}`,
    }));
  }
  return out;
}

type LocalScan = {
  refs: SourcedReference[];
  code: { label: string; facts: ScriptFacts }[];
  texts: { path: string; text: string }[];
  /** Module scripts loaded from archive files; browsers block these from disk (file://). */
  modules: string[];
  capabilities: Set<Capability>;
};

const decoder = new TextDecoder("utf-8");

/**
 * Follows references into the archive: stylesheets (with their imports, fonts and images),
 * scripts and module graphs are read and analyzed like inline code. Each file is read once.
 */
function scanLocalFiles(initial: SourcedReference[], local: LocalFiles): LocalScan {
  const scan: LocalScan = {
    refs: [],
    code: [],
    texts: [],
    modules: [],
    capabilities: new Set(),
  };
  const queue = [...initial];
  const visited = new Set<string>();
  for (let ref = queue.shift(); ref !== undefined; ref = queue.shift()) {
    scan.refs.push(ref);
    if (ref.kind === "network" || ref.base === undefined) continue;
    if (classifySpecifier(ref.specifier, { module: ref.module }) !== "relative") continue;
    const path = resolveLocalPath(ref.specifier, ref.base, local.rootPath);
    const bytes = path === null ? undefined : local.read(path);
    if (path === null || bytes === undefined) continue;
    ref.path = path;
    const followed = ref.kind === "stylesheet" || ref.kind === "script" || ref.kind === "module";
    if (!followed || visited.has(path)) continue;
    visited.add(path);
    const text = decoder.decode(bytes);
    scan.texts.push({ path, text });
    if (ref.kind === "stylesheet") {
      scan.capabilities.add("css");
      if (hasFontFace(text)) scan.capabilities.add("web-font");
      for (const css of extractCssReferences(text)) {
        if (css.kind === "image") scan.capabilities.add("image");
        queue.push({
          kind: css.kind,
          specifier: css.url,
          module: false,
          evidence: `${path} line ${css.line}`,
          base: path,
        });
      }
      continue;
    }
    const module = ref.kind === "module";
    if (module) scan.modules.push(path);
    const facts = inFile(analyzeScript(text, { module }), path);
    scan.code.push({ label: path, facts });
    queue.push(...codeReferences(facts, path, local.documentPath));
  }
  return scan;
}

function resolvesThroughImportMap(specifier: string, importMap: Map<string, string>): boolean {
  if (importMap.has(specifier)) return true;
  for (const key of importMap.keys()) {
    if (key.endsWith("/") && specifier.startsWith(key)) return true;
  }
  return false;
}

function mergeScriptFacts(all: ScriptFacts[]): ScriptFacts {
  const merged: ScriptFacts = {
    parsed: all.every((f) => f.parsed),
    network: [],
    websockets: [],
    staticImports: [],
    dynamicImports: [],
    workers: [],
    storage: [],
    dynamicCode: [],
    scriptInjection: [],
    hostApi: [],
  };
  for (const f of all) {
    for (const key of Object.keys(merged) as (keyof ScriptFacts)[]) {
      if (key === "parsed") continue;
      (merged[key] as CodeReference[]).push(...(f[key] as CodeReference[]));
    }
  }
  return merged;
}

/**
 * Statically analyzes one HTML document: dependencies, permissions, capabilities, findings
 * and a fidelity assessment. With `local` (the other files of a ZIP export), references to
 * those files are followed and their code and styles analyzed too. Deterministic; never
 * executes scripts or fetches resources.
 */
export function analyzeHtml(html: string, local?: LocalFiles): AnalysisResult {
  const facts = extractHtml(html);
  const documentBase = local?.documentPath;
  const perScript = facts.inlineCode.map((c) => ({
    label: `${c.label} line ${c.startLine}`,
    facts: analyzeScript(c.code, { module: c.module, startLine: c.startLine }),
  }));

  // Code-level references become dependencies too.
  const initial: SourcedReference[] = [
    ...facts.references.map((r) => ({ ...r, base: documentBase })),
    ...perScript.flatMap((p) => codeReferences(p.facts, documentBase, documentBase)),
  ];
  const scan = local
    ? scanLocalFiles(initial, local)
    : { refs: initial, code: [], texts: [], modules: [], capabilities: new Set<Capability>() };
  const allCode = [...perScript, ...scan.code];
  const code = mergeScriptFacts(allCode.map((p) => p.facts));
  const unparsed = allCode.filter((p) => !p.facts.parsed).map((p) => p.label);
  const dependencies = buildDependencies(scan.refs, facts.importMap);

  const capabilities = new Set<Capability>([...facts.capabilities, ...scan.capabilities]);
  if (dependencies.some((d) => d.kind === "image")) capabilities.add("image");
  if (dependencies.some((d) => d.kind === "font")) capabilities.add("web-font");
  if (code.network.length > 0) capabilities.add("network-fetch");
  if (code.websockets.length > 0) capabilities.add("websocket");
  if (code.storage.length > 0) capabilities.add("storage");
  if (code.dynamicCode.length > 0) capabilities.add("dynamic-code");
  if (code.workers.length > 0) capabilities.add("worker");
  if (code.hostApi.length > 0) capabilities.add("host-api");

  const scriptsPresent =
    facts.inlineScripts + facts.externalScripts + facts.eventHandlers + facts.javascriptUrls > 0;
  const runtimeNetwork = [...code.network, ...code.websockets].map(
    (r) => `${show(r.target)} (${where(r)})`,
  );
  const computedCode = [...code.dynamicImports, ...code.workers]
    .filter((r) => r.target === null)
    .map((r) => where(r));

  const fidelity = assessFidelity({
    staticTextChars: facts.staticTextChars,
    scriptsPresent,
    dependencies,
    runtimeNetwork,
    computedCode,
    remoteForms: facts.remoteForms,
    hostApi: code.hostApi.map(where),
    inArchive: local !== undefined,
    archiveModules: scan.modules,
  });

  const unbundled = dependencies.filter((d) => !d.bundled);
  const permissions = {
    scripts: scriptsPresent,
    network:
      unbundled.some((d) => d.location === "remote") ||
      runtimeNetwork.length > 0 ||
      facts.remoteForms.length > 0,
    storage: code.storage.length > 0,
  };

  const secrets = [
    ...findSecrets(html).map((h) => `${h.kind} line ${h.line}: ${h.preview}`),
    ...scan.texts.flatMap(({ path, text }) =>
      findSecrets(text).map((h) => `${h.kind} ${path} line ${h.line}: ${h.preview}`),
    ),
  ];
  const findings = buildFindings({
    facts,
    code,
    dependencies,
    unparsed,
    runtimeNetwork,
    computedCode,
    secrets,
    modules: scan.modules,
    inArchive: local !== undefined,
  });

  return {
    analysis: {
      // Stable vocabulary order, so reports diff cleanly.
      capabilities: CAPABILITIES.filter((c) => capabilities.has(c)),
      dependencies,
      permissions,
      fidelity,
      // No exporter exists yet, so no export target is claimed.
      exportOptions: [],
    },
    findings,
  };
}

type FindingInput = {
  facts: ReturnType<typeof extractHtml>;
  code: ScriptFacts;
  dependencies: Dependency[];
  unparsed: string[];
  runtimeNetwork: string[];
  computedCode: string[];
  /** Possible credentials, already formatted as evidence. */
  secrets: string[];
  modules: string[];
  inArchive: boolean;
};

function buildFindings({
  facts,
  code,
  dependencies,
  unparsed,
  runtimeNetwork,
  computedCode,
  secrets,
  modules,
  inArchive,
}: FindingInput): Finding[] {
  const findings: Finding[] = [];
  const add = (id: string, severity: Finding["severity"], message: string, evidence?: string[]) =>
    findings.push(
      evidence && evidence.length > 0
        ? { code: id, severity, message, evidence: capList(evidence) }
        : { code: id, severity, message },
    );

  const assets = dependencies.filter(
    (d) => !d.bundled && d.kind !== "network" && d.kind !== "frame",
  );
  const remote = assets.filter((d) => d.location === "remote");
  const missing = assets.filter((d) => d.location === "relative");
  const bare = assets.filter((d) => d.location === "bare");
  const frames = dependencies.filter((d) => d.kind === "frame" && d.location === "remote");

  if (remote.length > 0) {
    add(
      "dependency.remote",
      "warning",
      `${plural(remote.length, "remote resource")} must be bundled for the artifact to work offline.`,
      remote.map((d) => `${d.kind}: ${d.specifier}`),
    );
  }
  if (missing.length > 0) {
    add(
      "dependency.missing",
      "warning",
      inArchive
        ? `${plural(missing.length, "local file")} referenced but not found in the archive.`
        : `${plural(missing.length, "local file")} referenced but not included in this single file. Inspect the ZIP export to include them.`,
      missing.map((d) => `${d.kind}: ${d.specifier}`),
    );
  }
  if (bare.length > 0) {
    add(
      "dependency.bare-import",
      "warning",
      `${plural(bare.length, "module")} imported by name without an import map; browsers cannot load them as written.`,
      bare.map((d) => d.specifier),
    );
  }
  if (modules.length > 0) {
    add(
      "script.module-files",
      "warning",
      `${plural(modules.length, "module script")} ${modules.length === 1 ? "is" : "are"} loaded from separate files. Browsers do not run these when the page is opened from disk; open it through a local web server.`,
      modules,
    );
  }
  if (runtimeNetwork.length > 0) {
    add(
      "network.runtime",
      "warning",
      `Makes ${plural(runtimeNetwork.length, "network request")} at runtime; these features need a connection.`,
      runtimeNetwork,
    );
  }
  if (frames.length > 0) {
    add(
      "html.remote-frame",
      "warning",
      `Embeds ${plural(frames.length, "remote page")}; they will not load offline.`,
      frames.map((d) => d.specifier),
    );
  }
  if (facts.remoteForms.length > 0) {
    add(
      "html.remote-form",
      "warning",
      "A form sends data to a remote address when submitted.",
      facts.remoteForms.map(redactSecrets),
    );
  }
  if (facts.metaRefresh.length > 0) {
    add(
      "html.meta-refresh",
      "warning",
      "The page redirects or reloads itself automatically.",
      facts.metaRefresh.map(redactSecrets),
    );
  }
  if (facts.baseHref !== null) {
    add(
      "html.base",
      "info",
      `Relative URLs resolve against <base href="${truncate(redactSecrets(facts.baseHref))}">.`,
    );
  }
  const inlineTotal = facts.inlineScripts + facts.eventHandlers + facts.javascriptUrls;
  if (inlineTotal > 0) {
    const parts = [
      facts.inlineScripts > 0 ? plural(facts.inlineScripts, "inline script") : null,
      facts.eventHandlers > 0 ? plural(facts.eventHandlers, "event handler attribute") : null,
      facts.javascriptUrls > 0 ? plural(facts.javascriptUrls, "javascript: URL") : null,
    ].filter((p): p is string => p !== null);
    add(
      "script.inline",
      "info",
      `Contains ${parts.join(", ")}. Nothing is executed during inspection.`,
    );
  }
  if (unparsed.length > 0) {
    add(
      "script.unparsed",
      "info",
      `${plural(unparsed.length, "script")} could not be parsed as JavaScript (for example JSX compiled in the browser); simpler rules were used.`,
      unparsed,
    );
  }
  if (code.dynamicCode.length > 0) {
    add(
      "script.dynamic-code",
      "warning",
      "Runs code built from strings at runtime; that code cannot be inspected.",
      code.dynamicCode.map(where),
    );
  }
  if (computedCode.length > 0) {
    add(
      "script.dynamic-import",
      "warning",
      "Loads code from a location computed at runtime.",
      computedCode,
    );
  }
  if (code.scriptInjection.length > 0) {
    add(
      "script.injection",
      "warning",
      "Creates script elements at runtime; the code they load cannot be inspected.",
      code.scriptInjection.map(where),
    );
  }
  if (code.storage.length > 0) {
    add(
      "storage.persistent",
      "info",
      "Uses browser storage; saved state stays in the browser, not in the file.",
      code.storage.map(where),
    );
  }
  if (code.hostApi.length > 0) {
    add(
      "host.api",
      "warning",
      "Depends on an API that exists only inside the AI platform that created it; this behavior cannot be carried over.",
      code.hostApi.map(where),
    );
  }
  if (secrets.length > 0) {
    add(
      "secret.possible",
      "warning",
      `Found ${plural(secrets.length, "possible credential")}. Remove or rotate them before sharing this file.`,
      secrets,
    );
  }
  add(
    "fidelity.unverified",
    "info",
    "Fidelity is assessed by static analysis; it is not yet verified by exporting and reopening the artifact offline.",
  );
  return findings;
}
