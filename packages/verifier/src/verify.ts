import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_LIMITS,
  InputError,
  inspectBytes,
  type Limits,
  readInputFile,
  VERSION,
} from "@fidelark/core";
import {
  type BrowserCheck,
  type Dependency,
  type FidelityClass,
  type Finding,
  fidelityLabel,
  SCHEMA_VERSION,
  type Verdict,
  VerificationResult,
} from "@fidelark/schema";
import { BrowserLaunchError, findBrowser, runInBrowser } from "./browser.ts";

export type VerifyOptions = {
  /** Skip the browser check and only check that the file is self-contained. */
  staticOnly?: boolean;
  /** Run the browser without its sandbox. Only for trusted files on systems without one. */
  noSandbox?: boolean;
  executablePath?: string;
  timeoutMs?: number;
  settleMs?: number;
  limits?: Limits;
  now?: () => Date;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Verifies that an HTML file works offline: checks that every script, style, font, image and
 * media file is embedded, then opens the file in a sandboxed browser with all network access
 * blocked and records blocked requests and errors. The browser runs the file's scripts.
 */
export async function verifyFile(
  path: string,
  options: VerifyOptions = {},
): Promise<VerificationResult> {
  const now = options.now ?? (() => new Date());
  const bytes = await readInputFile(path, options.limits ?? DEFAULT_LIMITS);
  const report = inspectBytes(path, bytes, { now });
  if (report.input.format !== "html") {
    const hint =
      report.input.format === "zip"
        ? `; convert it into one HTML file first: fidelark convert ${report.input.name}`
        : "";
    throw new InputError(
      `verify supports HTML files only; this file looks like ${report.input.format}${hint}`,
    );
  }

  const unbundled: Dependency[] = (report.analysis?.dependencies ?? []).filter(
    (d) => !d.bundled && d.kind !== "network" && d.kind !== "frame",
  );
  const findings: Finding[] = [];
  let browser: BrowserCheck | null = null;

  if (options.staticOnly) {
    findings.push({
      code: "verify.skipped",
      severity: "info",
      message: "Browser check skipped (--static-only).",
    });
  } else {
    const executablePath = options.executablePath ?? (await findBrowser());
    if (executablePath === null) {
      findings.push({
        code: "verify.no-browser",
        severity: "warning",
        message:
          "No Chromium-based browser found. Install Chromium, Chrome or Edge, or set FIDELARK_BROWSER to its path.",
      });
    } else {
      try {
        browser = await runInBrowser(pathToFileURL(resolve(path)), {
          executablePath,
          sandbox: options.noSandbox !== true,
          timeoutMs: options.timeoutMs ?? 15_000,
          settleMs: options.settleMs ?? 1_500,
        });
      } catch (error) {
        if (!(error instanceof BrowserLaunchError)) throw error;
        findings.push({
          code: "verify.launch-failed",
          severity: "error",
          message: `The browser could not be started: ${error.message}`,
          ...(options.noSandbox
            ? {}
            : {
                evidence: [
                  "If this system has no browser sandbox, --no-sandbox runs without it; use it only for files you trust.",
                ],
              }),
        });
      }
    }
  }

  const staticClass = report.analysis?.fidelity.overall ?? null;
  const verdict = decide(browser, unbundled, staticClass);
  findings.push(...verdictFindings(browser, unbundled, staticClass, verdict));

  return VerificationResult.parse({
    schemaVersion: SCHEMA_VERSION,
    tool: { name: "fidelark", version: VERSION },
    generatedAt: now().toISOString(),
    input: report.input,
    selfContained: unbundled.length === 0,
    unbundled,
    browser,
    verdict,
    findings,
  });
}

/** Classes where static analysis already knows that some behavior will not work offline. */
const LIMITED: ReadonlySet<FidelityClass> = new Set([
  "connected",
  "static-fallback",
  "unsupported",
]);

/**
 * failed: the page did not load, or stayed blank while raising errors or being blocked.
 * partial: it opens offline but something was blocked, raised an error, is still external,
 * or static analysis found behavior that needs a connection or the original platform.
 * passed: none of the above.
 */
export function decide(
  browser: BrowserCheck | null,
  unbundled: readonly Dependency[],
  staticClass: FidelityClass | null = null,
): Verdict {
  if (browser === null) return "not-run";
  const broken = browser.pageErrors.length > 0 || browser.blockedRequests.length > 0;
  if (!browser.loaded || (browser.renderedTextChars === 0 && broken)) return "failed";
  if (
    broken ||
    browser.consoleErrors.length > 0 ||
    unbundled.length > 0 ||
    (staticClass !== null && LIMITED.has(staticClass))
  ) {
    return "partial";
  }
  return "passed";
}

function verdictFindings(
  browser: BrowserCheck | null,
  unbundled: readonly Dependency[],
  staticClass: FidelityClass | null,
  verdict: Verdict,
): Finding[] {
  const findings: Finding[] = [];
  if (unbundled.length > 0) {
    findings.push({
      code: "verify.not-self-contained",
      severity: "warning",
      message: `${plural(unbundled.length, "file")} still referenced from outside this file.`,
      evidence: unbundled.slice(0, 10).map((d) => `${d.kind} ${d.location}: ${d.specifier}`),
    });
  }
  if (browser === null) return findings;
  if (!browser.sandboxed) {
    findings.push({
      code: "verify.unsandboxed",
      severity: "warning",
      message: "The browser ran without its sandbox (--no-sandbox).",
    });
  }
  if (browser.blockedRequests.length > 0) {
    findings.push({
      code: "verify.blocked-requests",
      severity: "warning",
      message: `The page tried to make ${plural(browser.blockedRequests.length, "request")} that ${browser.blockedRequests.length === 1 ? "needs" : "need"} a connection; ${browser.blockedRequests.length === 1 ? "it was" : "they were"} blocked.`,
      evidence: browser.blockedRequests.slice(0, 10),
    });
  }
  if (browser.pageErrors.length > 0) {
    findings.push({
      code: "verify.page-errors",
      severity: verdict === "failed" ? "error" : "warning",
      message: `The page raised ${plural(browser.pageErrors.length, "uncaught error")} while running offline.`,
      evidence: browser.pageErrors.slice(0, 10),
    });
  }
  if (browser.consoleErrors.length > 0) {
    findings.push({
      code: "verify.console-errors",
      severity: "warning",
      message: `The page logged ${plural(browser.consoleErrors.length, "error")} to the console.`,
      evidence: browser.consoleErrors.slice(0, 10),
    });
  }
  if (browser.loaded && browser.renderedTextChars === 0) {
    findings.push({
      code: "verify.blank",
      severity: verdict === "failed" ? "error" : "info",
      message: "No visible text after loading (expected for canvas-only pages).",
    });
  }
  const quiet = browser.blockedRequests.length === 0 && browser.pageErrors.length === 0;
  if (quiet && staticClass !== null && LIMITED.has(staticClass)) {
    findings.push({
      code: "verify.static-limits",
      severity: "warning",
      message: `Static analysis rated this file ${fidelityLabel(staticClass)}. The offline smoke test only loads the page; it does not click or type, so behavior that needs a connection or the original platform was not exercised.`,
    });
  }
  if (verdict === "passed") {
    findings.push({
      code: "verify.passed",
      severity: "info",
      message: `Opened offline in ${browser.browser} with all network access blocked: no requests, no errors.`,
    });
  }
  return findings;
}
