import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { basename } from "node:path";
import { analyzeHtml } from "@fidelark/analyzer";
import {
  type Analysis,
  type Finding,
  type InputFormat,
  PortabilityReport,
  SCHEMA_VERSION,
} from "@fidelark/schema";
import pkg from "../package.json" with { type: "json" };
import { classifyInput } from "./classify.ts";
import { DEFAULT_LIMITS, type Limits } from "./limits.ts";

export const VERSION: string = pkg.version;

export type InspectOptions = {
  limits?: Limits;
  /** Injectable clock for deterministic reports. */
  now?: () => Date;
};

/** The input could not be opened as a regular file; no report can be produced. */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

const notAnalyzed = (format: InputFormat): Finding => ({
  code: "analysis.not-implemented",
  severity: "info",
  message: `Static analysis for ${format} input is not implemented yet, so fidelity has not been assessed.`,
});

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

function buildReport(
  name: string,
  sizeBytes: number,
  sha256: string | null,
  format: InputFormat,
  findings: Finding[],
  options: InspectOptions,
  analysis: Analysis | null = null,
): PortabilityReport {
  const now = options.now ?? (() => new Date());
  // Parsing guarantees every report we emit matches the published contract.
  return PortabilityReport.parse({
    schemaVersion: SCHEMA_VERSION,
    tool: { name: "fidelark", version: VERSION },
    generatedAt: now().toISOString(),
    input: { name, format, sizeBytes, sha256 },
    analysis,
    findings,
  });
}

/** Inspects in-memory bytes. Never executes, renders or fetches anything from the input. */
export function inspectBytes(
  name: string,
  bytes: Uint8Array,
  options: InspectOptions = {},
): PortabilityReport {
  const limits = options.limits ?? DEFAULT_LIMITS;
  const displayName = basename(name);
  if (bytes.byteLength > limits.maxInputBytes) {
    return buildReport(displayName, bytes.byteLength, null, "unknown", [tooLarge(limits)], options);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { format, findings } = classifyInput(displayName, bytes);
  if (format === "html") {
    const result = analyzeHtml(decodeText(bytes));
    findings.push(...result.findings);
    return buildReport(
      displayName,
      bytes.byteLength,
      sha256,
      format,
      findings,
      options,
      result.analysis,
    );
  }
  if (format !== "unknown") {
    findings.push(notAnalyzed(format));
  }
  return buildReport(displayName, bytes.byteLength, sha256, format, findings, options);
}

/**
 * Inspects a file on disk. The size limit is checked before reading,
 * so oversized inputs are never loaded into memory.
 */
export async function inspectFile(
  path: string,
  options: InspectOptions = {},
): Promise<PortabilityReport> {
  const limits = options.limits ?? DEFAULT_LIMITS;
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(path, "r");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    throw new InputError(
      code === "ENOENT" ? `File not found: ${path}` : `Cannot open ${path} (${code})`,
    );
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) {
      throw new InputError(`Not a regular file: ${path}`);
    }
    if (stat.size > limits.maxInputBytes) {
      return buildReport(basename(path), stat.size, null, "unknown", [tooLarge(limits)], options);
    }
    const bytes = await handle.readFile();
    return inspectBytes(path, bytes, options);
  } finally {
    await handle.close();
  }
}

/**
 * Reads a whole input file for commands that need its bytes (convert, verify).
 * Unlike `inspectFile`, an oversized input is an error rather than a report.
 */
export async function readInputFile(
  path: string,
  limits: Limits = DEFAULT_LIMITS,
): Promise<Buffer> {
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(path, "r");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    throw new InputError(
      code === "ENOENT" ? `File not found: ${path}` : `Cannot open ${path} (${code})`,
    );
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new InputError(`Not a regular file: ${path}`);
    if (stat.size > limits.maxInputBytes) {
      throw new InputError(`Input exceeds the ${limits.maxInputBytes}-byte limit: ${path}`);
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function tooLarge(limits: Limits): Finding {
  return {
    code: "input.too-large",
    severity: "error",
    message: `Input exceeds the ${limits.maxInputBytes}-byte limit and was not read.`,
  };
}
