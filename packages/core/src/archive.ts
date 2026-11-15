import { createHash } from "node:crypto";
import type { ArchiveInfo, Finding, Severity } from "@fidelark/schema";
import { DEFAULT_LIMITS, type Limits } from "./limits.ts";
import { displayName, readZip, type SkipCode, safePath, type ZipSkip } from "./zip.ts";

/** A ZIP export read into memory, with the HTML document chosen for analysis. */
export type OpenedArchive = {
  files: ReadonlyMap<string, Uint8Array>;
  /** Path of the HTML document to analyze, or null when none could be chosen. */
  entry: string | null;
  /** Folder that root-relative references resolve against: the single top-level folder, or "". */
  root: string;
  info: ArchiveInfo;
  findings: Finding[];
};

const entries = (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`;
const was = (n: number) => (n === 1 ? "was" : "were");
/** Present-tense verb agreeing with a count: verb(1, "uses", "use") → "uses". */
const verb = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** One finding per kind of skipped entry; the reason for each entry is in the evidence. */
const SKIPPED: Record<SkipCode, { severity: Severity; message: (n: number) => string }> = {
  "zip.metadata": {
    severity: "info",
    message: (n) => `Ignored ${entries(n)} of operating system metadata.`,
  },
  "zip.unsafe-path": {
    severity: "warning",
    message: (n) =>
      `${entries(n)} with unsafe names (absolute, leaving the archive or with control characters) ${was(n)} not read.`,
  },
  "zip.symlink": {
    severity: "warning",
    message: (n) =>
      `${entries(n)} ${n === 1 ? "is a symbolic link" : "are symbolic links"} and ${was(n)} not followed.`,
  },
  "zip.encrypted": {
    severity: "warning",
    message: (n) => `${entries(n)} ${n === 1 ? "is" : "are"} encrypted and ${was(n)} not read.`,
  },
  "zip.unsupported-method": {
    severity: "warning",
    message: (n) =>
      `${entries(n)} ${verb(n, "uses", "use")} an unsupported compression method and ${was(n)} not read.`,
  },
  "zip.duplicate-entry": {
    severity: "warning",
    message: (n) =>
      `${entries(n)} ${verb(n, "repeats", "repeat")} the name of an earlier entry and ${was(n)} not read.`,
  },
  "zip.entry-too-large": {
    severity: "warning",
    message: (n) =>
      `${entries(n)} ${verb(n, "exceeds", "exceed")} the size limit for one file and ${was(n)} not read.`,
  },
  "zip.compression-ratio": {
    severity: "warning",
    message: (n) =>
      `${entries(n)} ${verb(n, "expands", "expand")} far more than real files do, which is how ZIP bombs work, and ${was(n)} not read.`,
  },
  "zip.size-limit": {
    severity: "warning",
    message: (n) => `The archive's total size limit was reached; ${entries(n)} ${was(n)} not read.`,
  },
  "zip.overlapping-entry": {
    severity: "warning",
    message: (n) =>
      `${entries(n)} ${verb(n, "shares", "share")} data with another entry, a ZIP bomb technique, and ${was(n)} not read.`,
  },
  "zip.corrupt-entry": {
    severity: "warning",
    message: (n) =>
      `${entries(n)} ${n === 1 ? "is" : "are"} damaged (sizes or checksums do not match) and ${was(n)} not read.`,
  },
};

function skippedFindings(skipped: readonly ZipSkip[]): Finding[] {
  const byCode = new Map<SkipCode, ZipSkip[]>();
  for (const s of skipped) byCode.set(s.code, [...(byCode.get(s.code) ?? []), s]);
  return [...byCode].map(([code, list]) => {
    const evidence = list.map((s) => `${s.path}: ${s.reason}`);
    return {
      code,
      severity: SKIPPED[code].severity,
      message: SKIPPED[code].message(list.length),
      evidence:
        evidence.length > 10
          ? [...evidence.slice(0, 10), `… and ${evidence.length - 10} more`]
          : evidence,
    };
  });
}

/** The single top-level folder that holds every file (the usual "zip a folder" layout), or "". */
function commonFolder(paths: readonly string[]): string {
  const tops = new Set(paths.map((p) => (p.includes("/") ? p.slice(0, p.indexOf("/")) : "")));
  const [only] = tops;
  return tops.size === 1 && only !== undefined ? only : "";
}

const isHtml = (path: string) => /\.html?$/i.test(path);

function chooseEntry(
  paths: readonly string[],
  requested: string | undefined,
): { entry: string | null; finding?: Finding } {
  const documents = paths.filter(isHtml);
  if (requested !== undefined) {
    const wanted = safePath(requested.trim());
    const entry = "path" in wanted ? wanted.path : null;
    if (entry !== null && documents.includes(entry)) return { entry };
    return {
      entry: null,
      finding: {
        code: "zip.entry-not-found",
        severity: "error",
        message: `The archive has no HTML document at "${displayName(requested)}".`,
        ...(documents.length > 0 ? { evidence: documents.slice(0, 10) } : {}),
      },
    };
  }
  const folder = commonFolder(paths);
  const prefix = folder === "" ? "" : `${folder}/`;
  const index = documents.find(
    (p) => p.startsWith(prefix) && /^index\.html?$/i.test(p.slice(prefix.length)),
  );
  if (index !== undefined) return { entry: index };
  if (documents.length === 1) return { entry: documents[0] ?? null };
  if (documents.length === 0) {
    return {
      entry: null,
      finding: {
        code: "zip.no-entry",
        severity: "error",
        message: "The archive contains no HTML document to analyze.",
      },
    };
  }
  return {
    entry: null,
    finding: {
      code: "zip.ambiguous-entry",
      severity: "error",
      message: `The archive has ${documents.length} HTML documents and no index.html; choose one with --entry.`,
      evidence: documents.slice(0, 10),
    },
  };
}

/**
 * Reads a ZIP export in memory and chooses the HTML document to analyze: `requested` if given,
 * else index.html at the top (or inside the single top-level folder), else the only HTML file.
 */
export function openArchive(
  bytes: Uint8Array,
  limits: Limits = DEFAULT_LIMITS,
  requested?: string,
): OpenedArchive {
  const result = readZip(bytes, {
    maxEntries: limits.maxArchiveEntries ?? DEFAULT_LIMITS.maxArchiveEntries,
    maxEntryBytes: limits.maxInputBytes,
    maxTotalBytes: limits.maxArchiveBytes ?? DEFAULT_LIMITS.maxArchiveBytes,
    maxCompressionRatio: limits.maxCompressionRatio ?? DEFAULT_LIMITS.maxCompressionRatio,
  });
  if (!result.ok) {
    return {
      files: new Map(),
      entry: null,
      root: "",
      info: { entry: null, files: [], skipped: [], totalBytes: 0 },
      findings: [
        {
          code: result.code,
          severity: "error",
          message: `The ZIP archive was not read: ${result.reason}.`,
        },
      ],
    };
  }

  const files = new Map(result.files.map((f) => [f.path, f.bytes]));
  const paths = [...files.keys()];
  const { entry, finding } = chooseEntry(paths, requested);
  const findings = skippedFindings(result.skipped);
  if (finding) findings.push(finding);
  const folder = commonFolder(paths);
  return {
    files,
    entry,
    root: folder !== "" && entry?.startsWith(`${folder}/`) ? folder : "",
    info: {
      entry,
      files: result.files.map((f) => ({
        path: f.path,
        sizeBytes: f.bytes.byteLength,
        sha256: createHash("sha256").update(f.bytes).digest("hex"),
      })),
      skipped: result.skipped.map(({ path, reason }) => ({ path, reason })),
      totalBytes: result.files.reduce((sum, f) => sum + f.bytes.byteLength, 0),
    },
    findings,
  };
}
