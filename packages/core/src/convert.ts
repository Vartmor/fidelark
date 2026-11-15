import { basename, dirname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type ArchiveSource,
  createLoader,
  exportStandaloneHtml,
  type fetchRemote,
  type RemoteOptions,
} from "@fidelark/exporter";
import { ConversionResult, SCHEMA_VERSION } from "@fidelark/schema";
import type { OpenedArchive } from "./archive.ts";
import { InputError, inspectBytes, inspectInput, readInputFile, VERSION } from "./inspect.ts";
import { DEFAULT_LIMITS, type Limits } from "./limits.ts";

export type ConvertOptions = {
  /** Download remote dependencies. Off by default: nothing leaves the machine unless asked. */
  allowNetwork?: boolean;
  /** Local files are only read from inside this directory; defaults to the input's directory. */
  baseDir?: string;
  /** ZIP input: the HTML document to convert, by its path in the archive. */
  entry?: string;
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

/** Archive files are served under this URL; it never maps to a real path on disk. */
const ARCHIVE_ROOT = new URL("file:///fidelark-archive/");

const archiveUrl = (path: string) =>
  new URL(path.split("/").map(encodeURIComponent).join("/"), ARCHIVE_ROOT);

type Source = {
  html: string;
  documentUrl: URL;
  rootUrl: URL;
  local: { baseDir: string } | { archive: ArchiveSource };
};

function archiveSource(archive: OpenedArchive, entry: string, html: Uint8Array): Source {
  return {
    html: new TextDecoder("utf-8").decode(html),
    documentUrl: archiveUrl(entry),
    rootUrl: archive.root === "" ? ARCHIVE_ROOT : archiveUrl(`${archive.root}/`),
    local: { archive: { root: ARCHIVE_ROOT, read: (p) => archive.files.get(p) } },
  };
}

/**
 * Converts an HTML artifact, or the entry document of a ZIP export, into one self-contained
 * HTML file. Returns the new HTML (the caller decides where to write it) and a result with the
 * embedded manifest and the portability reports before and after. The input is parsed, never
 * executed; a ZIP is read in memory and never extracted.
 */
export async function convertFile(
  path: string,
  outputName: string,
  options: ConvertOptions = {},
): Promise<ConversionOutput> {
  const limits = options.limits ?? DEFAULT_LIMITS;
  const now = options.now ?? (() => new Date());
  const bytes = await readInputFile(path, limits);
  const { report: before, archive } = inspectInput(path, bytes, {
    limits,
    now,
    ...(options.entry !== undefined ? { entry: options.entry } : {}),
  });

  let source: Source;
  if (before.input.format === "zip") {
    if (options.baseDir !== undefined) {
      throw new InputError("--base does not apply to ZIP input; files are read from the archive");
    }
    const entry = archive?.entry ?? null;
    const html = entry === null ? undefined : archive?.files.get(entry);
    if (archive === null || entry === null || html === undefined) {
      const reason = before.findings.find((f) => f.severity === "error")?.message;
      throw new InputError(
        `${basename(path)} has no HTML document to convert${reason ? `: ${reason}` : ""}`,
      );
    }
    source = archiveSource(archive, entry, html);
  } else if (before.input.format === "html") {
    const baseDir = resolve(options.baseDir ?? dirname(path));
    source = {
      html: new TextDecoder("utf-8").decode(bytes),
      documentUrl: pathToFileURL(resolve(path)),
      rootUrl: pathToFileURL(baseDir.endsWith(sep) ? baseDir : `${baseDir}${sep}`),
      local: { baseDir },
    };
  } else {
    throw new InputError(
      `convert supports HTML and ZIP input; ${basename(path)} looks like ${before.input.format}`,
    );
  }

  const loader = createLoader({
    ...source.local,
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
  const exported = await exportStandaloneHtml(source.html, {
    sourceName: basename(path),
    ...(before.input.sha256 ? { sourceSha256: before.input.sha256 } : {}),
    documentUrl: source.documentUrl,
    rootUrl: source.rootUrl,
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
