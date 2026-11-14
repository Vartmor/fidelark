import { basename, dirname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createLoader,
  exportStandaloneHtml,
  type fetchRemote,
  type RemoteOptions,
} from "@fidelark/exporter";
import { ConversionResult, SCHEMA_VERSION } from "@fidelark/schema";
import { InputError, inspectBytes, readInputFile, VERSION } from "./inspect.ts";
import { DEFAULT_LIMITS, type Limits } from "./limits.ts";

export type ConvertOptions = {
  /** Download remote dependencies. Off by default: nothing leaves the machine unless asked. */
  allowNetwork?: boolean;
  /** Local files are only read from inside this directory; defaults to the input's directory. */
  baseDir?: string;
  limits?: Limits;
  maxResourceBytes?: number;
  maxTotalBytes?: number;
  now?: () => Date;
  /** For tests: replace the network client or relax its options. */
  fetchRemote?: typeof fetchRemote;
  remote?: Partial<RemoteOptions>;
};

export type ConversionOutput = {
  html: string;
  result: ConversionResult;
};

export const DEFAULT_MAX_RESOURCE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

/**
 * Converts an HTML artifact into one self-contained HTML file. Returns the new HTML (the caller
 * decides where to write it) and a result with the embedded manifest and the portability
 * reports before and after. The input is parsed, never executed.
 */
export async function convertFile(
  path: string,
  outputName: string,
  options: ConvertOptions = {},
): Promise<ConversionOutput> {
  const limits = options.limits ?? DEFAULT_LIMITS;
  const now = options.now ?? (() => new Date());
  const bytes = await readInputFile(path, limits);
  const before = inspectBytes(path, bytes, { limits, now });
  if (before.input.format !== "html") {
    throw new InputError(
      `convert supports HTML input only; ${basename(path)} looks like ${before.input.format}`,
    );
  }

  const baseDir = resolve(options.baseDir ?? dirname(path));
  const loader = createLoader({
    baseDir,
    allowNetwork: options.allowNetwork === true,
    maxResourceBytes: options.maxResourceBytes ?? DEFAULT_MAX_RESOURCE_BYTES,
    remote: {
      timeoutMs: 15_000,
      maxRedirects: 5,
      userAgent: `fidelark/${VERSION}`,
      ...options.remote,
    },
    ...(options.fetchRemote ? { fetchRemote: options.fetchRemote } : {}),
  });
  const exported = await exportStandaloneHtml(new TextDecoder("utf-8").decode(bytes), {
    sourceName: basename(path),
    documentUrl: pathToFileURL(resolve(path)),
    rootUrl: pathToFileURL(baseDir.endsWith(sep) ? baseDir : `${baseDir}${sep}`),
    loader,
    maxTotalBytes: options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES,
    toolVersion: VERSION,
    now,
  });

  const after = inspectBytes(outputName, new TextEncoder().encode(exported.html), {
    // The output may legitimately exceed the input limit after embedding.
    limits: { ...limits, maxInputBytes: Number.MAX_SAFE_INTEGER },
    now,
  });
  const result = ConversionResult.parse({
    schemaVersion: SCHEMA_VERSION,
    tool: { name: "fidelark", version: VERSION },
    generatedAt: now().toISOString(),
    manifest: exported.manifest,
    findings: exported.findings,
    before,
    after,
  });
  return { html: exported.html, result };
}
