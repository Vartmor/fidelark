import {
  type Analysis,
  CAPABILITIES,
  type Capability,
  type Dependency,
  type DependencyKind,
  type Finding,
} from "@fidelark/schema";
import { assessFidelity } from "./fidelity.ts";
import { extractHtml, type RawReference } from "./html.ts";
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

/** Merges references to the same resource and classifies where each one lives. */
function buildDependencies(refs: RawReference[], importMap: Map<string, string>): Dependency[] {
  const byKey = new Map<string, Dependency>();
  for (const ref of refs) {
    const location = classifySpecifier(ref.specifier, { module: ref.module });
    if (location === null) continue;
    if (location === "bare" && resolvesThroughImportMap(ref.specifier, importMap)) continue;
    const specifier = truncate(redactSecrets(ref.specifier));
    const key = `${ref.kind}|${specifier}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.evidence.includes(ref.evidence)) existing.evidence.push(ref.evidence);
      continue;
    }
    byKey.set(key, {
      kind: ref.kind,
      specifier,
      location,
      bundled: location === "embedded",
      evidence: [ref.evidence],
    });
  }
  return [...byKey.values()];
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
 * and a fidelity assessment. Deterministic; never executes scripts or fetches resources.
 */
export function analyzeHtml(html: string): AnalysisResult {
  const facts = extractHtml(html);
  const perScript = facts.inlineCode.map((c) => ({
    code: c,
    facts: analyzeScript(c.code, { module: c.module, startLine: c.startLine }),
  }));
  const code = mergeScriptFacts(perScript.map((p) => p.facts));
  const unparsed = perScript
    .filter((p) => !p.facts.parsed)
    .map((p) => `${p.code.label} line ${p.code.startLine}`);

  // Code-level references become dependencies too.
  const refs: RawReference[] = [...facts.references];
  const addCodeRefs = (list: CodeReference[], kind: DependencyKind, module: boolean) => {
    for (const r of list) {
      if (r.target !== null && r.target !== "")
        refs.push({ kind, specifier: r.target, module, evidence: where(r) });
    }
  };
  addCodeRefs(code.staticImports, "module", true);
  addCodeRefs(code.dynamicImports, "module", true);
  addCodeRefs(code.workers, "script", false);
  addCodeRefs(code.network, "network", false);
  addCodeRefs(code.websockets, "network", false);
  const dependencies = buildDependencies(refs, facts.importMap);

  const capabilities = new Set<Capability>(facts.capabilities);
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

  const findings = buildFindings({
    facts,
    code,
    dependencies,
    unparsed,
    runtimeNetwork,
    computedCode,
    html,
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
  html: string;
};

function buildFindings({
  facts,
  code,
  dependencies,
  unparsed,
  runtimeNetwork,
  computedCode,
  html,
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
      `${plural(missing.length, "local file")} referenced but not included in this single file. Inspect the ZIP export to include them.`,
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
  const secrets = findSecrets(html);
  if (secrets.length > 0) {
    add(
      "secret.possible",
      "warning",
      `Found ${plural(secrets.length, "possible credential")}. Remove or rotate them before sharing this file.`,
      secrets.map((s) => `${s.kind} line ${s.line}: ${s.preview}`),
    );
  }
  add(
    "fidelity.unverified",
    "info",
    "Fidelity is assessed by static analysis; it is not yet verified by exporting and reopening the artifact offline.",
  );
  return findings;
}
