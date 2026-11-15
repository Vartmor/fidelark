import {
  type AxisAssessment,
  type Dependency,
  type FidelityAssessment,
  type FidelityClass,
  worstFidelity,
} from "@fidelark/schema";
import { capList, plural } from "./text.ts";

/** Everything the fidelity rules need, already extracted and classified. */
export type FidelitySignals = {
  staticTextChars: number;
  scriptsPresent: boolean;
  dependencies: readonly Dependency[];
  /** Evidence for runtime network use (fetch, XHR, WebSocket, beacons, ...). */
  runtimeNetwork: readonly string[];
  /** Evidence for code loaded from locations computed at runtime. */
  computedCode: readonly string[];
  remoteForms: readonly string[];
  hostApi: readonly string[];
  /** True when the document was analyzed with the other files of its ZIP archive. */
  inArchive?: boolean;
  /** Module scripts loaded from archive files; they need bundling or a web server to run. */
  archiveModules?: readonly string[];
  /** Evidence for moves to a remote or computed address (location, window.open, meta refresh). */
  navigation?: readonly string[];
};

type Rule = { class: FidelityClass; evidence: string };

const VISUAL_KINDS = new Set(["stylesheet", "font", "image", "media"]);
const CODE_KINDS = new Set(["script", "module"]);

function axis(rules: Rule[], fallback: Rule): AxisAssessment {
  const applied = rules.length > 0 ? rules : [fallback];
  const cls = worstFidelity(applied.map((r) => r.class));
  // Most severe evidence first, so the reason for the class leads.
  const ordered = [...applied].sort((a, b) => Number(b.class === cls) - Number(a.class === cls));
  return { class: cls, evidence: ordered.map((r) => r.evidence) };
}

const describe = (deps: readonly Dependency[]) =>
  capList(
    deps.map((d) => d.specifier),
    3,
  ).join(", ");

/**
 * Deterministic fidelity rules for an HTML document, alone or in its ZIP archive
 * (docs/adr/0010, docs/adr/0012). The result is what static analysis says can be preserved;
 * it is not verified by an offline export yet.
 */
export function assessFidelity(s: FidelitySignals): FidelityAssessment {
  const deps = s.dependencies.filter((d) => !d.bundled);
  const notHere = s.inArchive ? "not in the archive" : "not included in this file";
  const archiveModules = s.archiveModules ?? [];
  const remote = (kinds: Set<string>) =>
    deps.filter((d) => kinds.has(d.kind) && d.location === "remote");
  const missing = (kinds: Set<string>) =>
    deps.filter((d) => kinds.has(d.kind) && (d.location === "relative" || d.location === "bare"));
  const remoteFrames = deps.filter((d) => d.kind === "frame" && d.location === "remote");

  // Visual
  const visualRules: Rule[] = [];
  if (remoteFrames.length > 0) {
    visualRules.push({
      class: "connected",
      evidence: `${plural(remoteFrames.length, "embedded remote page")} ${remoteFrames.length === 1 ? "needs" : "need"} a connection: ${describe(remoteFrames)}.`,
    });
  }
  const missingVisual = missing(VISUAL_KINDS);
  if (missingVisual.length > 0) {
    visualRules.push({
      class: "semantic-equivalent",
      evidence: `${plural(missingVisual.length, "local style or media file")} ${missingVisual.length === 1 ? "is" : "are"} ${notHere}: ${describe(missingVisual)}.`,
    });
  }
  const remoteVisual = remote(VISUAL_KINDS);
  if (remoteVisual.length > 0) {
    visualRules.push({
      class: "bundled-portable",
      evidence: `${plural(remoteVisual.length, "remote style, font or media file")} can be bundled for offline use.`,
    });
  }
  const visual = axis(visualRules, {
    class: "exact-portable",
    evidence: s.inArchive
      ? "All styles and images are inline, embedded or in the archive."
      : "All styles and images are inline or embedded.",
  });

  // Behavioral
  const behaviorRules: Rule[] = [];
  for (const e of s.hostApi) {
    behaviorRules.push({
      class: "unsupported",
      evidence: `Uses a host-only API outside a standard browser: ${e}.`,
    });
  }
  const missingCode = missing(CODE_KINDS);
  if (missingCode.length > 0) {
    behaviorRules.push({
      class: "static-fallback",
      evidence: `${plural(missingCode.length, "script")} ${s.inArchive ? "cannot be found in the archive" : "cannot be resolved from this file"}: ${describe(missingCode)}.`,
    });
  }
  if (s.runtimeNetwork.length > 0) {
    behaviorRules.push({
      class: "connected",
      evidence: `Makes ${plural(s.runtimeNetwork.length, "network request")} at runtime: ${capList(s.runtimeNetwork, 3).join("; ")}.`,
    });
  }
  for (const e of s.computedCode)
    behaviorRules.push({
      class: "connected",
      evidence: `Loads code from a location computed at runtime: ${e}.`,
    });
  for (const e of s.navigation ?? [])
    behaviorRules.push({
      class: "connected",
      evidence: `Sends the reader to a page that needs a connection: ${e}.`,
    });
  for (const e of s.remoteForms)
    behaviorRules.push({
      class: "connected",
      evidence: `Submits a form to a remote address: ${e}.`,
    });
  if (remoteFrames.length > 0)
    behaviorRules.push({
      class: "connected",
      evidence: "Embedded remote pages need a connection.",
    });
  if (archiveModules.length > 0) {
    behaviorRules.push({
      class: "bundled-portable",
      evidence: `${plural(archiveModules.length, "module script")} in the archive ${archiveModules.length === 1 ? "needs" : "need"} bundling or a local web server to run from disk: ${capList(archiveModules, 3).join(", ")}.`,
    });
  }
  const remoteCode = remote(CODE_KINDS);
  if (remoteCode.length > 0) {
    behaviorRules.push({
      class: "bundled-portable",
      evidence: `${plural(remoteCode.length, "remote script")} can be bundled for offline use.`,
    });
  }
  const behavioral = axis(
    behaviorRules,
    s.scriptsPresent
      ? {
          class: "exact-portable",
          evidence: s.inArchive
            ? "Scripts are inline or in the archive and make no network requests."
            : "Scripts are inline and make no network requests.",
        }
      : { class: "exact-portable", evidence: "No scripts; the document is static." },
  );

  // Content
  const content: AxisAssessment =
    s.staticTextChars > 0
      ? {
          class: "exact-portable",
          evidence: [`${s.staticTextChars} characters of static text are in the document.`],
        }
      : s.scriptsPresent
        ? {
            class: behavioral.class,
            evidence: ["Content is rendered by scripts, so it follows behavioral fidelity."],
          }
        : { class: "exact-portable", evidence: ["The document has no text content."] };

  return {
    overall: worstFidelity([content.class, visual.class, behavioral.class]),
    axes: { content, visual, behavioral },
  };
}
