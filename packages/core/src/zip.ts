import { crc32, inflateRawSync } from "node:zlib";

/**
 * A strict, in-memory ZIP reader for untrusted archives (docs/adr/0012). It never writes to disk
 * and reads an entry only when its name is safe and its sizes fit the limits. Anything unusual
 * (symbolic links, encryption, overlapping data, mismatched sizes or checksums) is skipped and
 * reported instead of being worked around.
 */

export type ArchiveLimits = {
  maxEntries: number;
  /** Largest uncompressed size of a single entry. */
  maxEntryBytes: number;
  /** Largest uncompressed size of all entries together. */
  maxTotalBytes: number;
  /** Entries over 1 MiB that expand more than this are treated as ZIP bombs. */
  maxCompressionRatio: number;
};

export type SkipCode =
  | "zip.metadata"
  | "zip.unsafe-path"
  | "zip.symlink"
  | "zip.encrypted"
  | "zip.unsupported-method"
  | "zip.duplicate-entry"
  | "zip.entry-too-large"
  | "zip.compression-ratio"
  | "zip.size-limit"
  | "zip.overlapping-entry"
  | "zip.corrupt-entry";

export type ZipFile = { path: string; bytes: Uint8Array };
export type ZipSkip = { path: string; code: SkipCode; reason: string };

export type ZipReadResult =
  | { ok: true; files: ZipFile[]; skipped: ZipSkip[] }
  | { ok: false; code: "zip.unreadable" | "zip.too-many-entries"; reason: string };

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_SIZE = 22;
const CENTRAL_SIZE = 46;
const LOCAL_SIZE = 30;
const MAX_COMMENT = 0xffff;
const RATIO_THRESHOLD_BYTES = 1024 * 1024;
const UTF8_FLAG = 0x800;
const ENCRYPTED_FLAGS = 0x1 | 0x40;
const UNIX = 3;
const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

// C0 and C1 control characters: they could rewrite a terminal when a name is printed.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point.
const CONTROL_ALL = /[\u0000-\u001f\u007f-\u009f]/g;

/** An entry name as it may be shown to people: control characters escaped, length capped. */
export function displayName(raw: string): string {
  const escaped = raw.replace(
    CONTROL_ALL,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  return escaped.length > 200 ? `${escaped.slice(0, 199)}…` : escaped || "(empty name)";
}

/**
 * Turns an entry name into a safe relative path, or explains why it is unsafe. Backslashes
 * count as separators; `.` segments and repeated slashes are dropped.
 */
export function safePath(raw: string): { path: string } | { unsafe: string } {
  if (CONTROL.test(raw)) return { unsafe: "name contains control characters" };
  const name = raw.replace(/\\/g, "/");
  if (name.startsWith("/") || /^[a-z]:/i.test(name)) return { unsafe: "absolute path" };
  const parts: string[] = [];
  for (const segment of name.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") return { unsafe: "path leaves the archive" };
    parts.push(segment);
  }
  return parts.length > 0 ? { path: parts.join("/") } : { unsafe: "empty name" };
}

const isMetadata = (path: string) =>
  path.startsWith("__MACOSX/") || /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/i.test(path);

function decodeName(bytes: Uint8Array, utf8Flag: boolean): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Without the UTF-8 flag, names are in a legacy code page; Latin-1 keeps them stable.
    return utf8Flag
      ? new TextDecoder("utf-8").decode(bytes)
      : new TextDecoder("latin1").decode(bytes);
  }
}

/** Offset of the end-of-central-directory record, searching back over a trailing comment. */
function findEnd(view: DataView): number {
  const last = view.byteLength - EOCD_SIZE;
  const first = Math.max(0, last - MAX_COMMENT);
  for (let at = last; at >= first; at--) {
    if (view.getUint32(at, true) !== EOCD_SIGNATURE) continue;
    if (at + EOCD_SIZE + view.getUint16(at + 20, true) <= view.byteLength) return at;
  }
  return -1;
}

type Candidate = {
  path: string;
  raw: string;
  method: number;
  crc: number;
  compressedSize: number;
  size: number;
  start: number;
  dataStart: number;
  dataEnd: number;
};

/** Reads every safe file of a ZIP archive into memory, in central-directory order. */
export function readZip(bytes: Uint8Array, limits: ArchiveLimits): ZipReadResult {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fail = (reason: string): ZipReadResult => ({ ok: false, code: "zip.unreadable", reason });
  if (bytes.byteLength < EOCD_SIZE) return fail("the file is too short to be a ZIP archive");

  const end = findEnd(view);
  if (end < 0) return fail("no end-of-central-directory record; the archive is truncated");
  const disk = view.getUint16(end + 4, true);
  const centralDisk = view.getUint16(end + 6, true);
  const entriesOnDisk = view.getUint16(end + 8, true);
  const entryCount = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    return fail("ZIP64 archives are not supported");
  }
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    return fail("multi-part archives are not supported");
  }
  if (entryCount > limits.maxEntries) {
    return {
      ok: false,
      code: "zip.too-many-entries",
      reason: `the archive has ${entryCount} entries; the limit is ${limits.maxEntries}`,
    };
  }
  if (centralOffset + centralSize > end) return fail("the central directory is out of bounds");

  const skipped: ZipSkip[] = [];
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  let at = centralOffset;
  for (let i = 0; i < entryCount; i++) {
    if (at + CENTRAL_SIZE > centralOffset + centralSize) {
      return fail("the central directory is truncated");
    }
    if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) {
      return fail("the central directory is corrupt");
    }
    const madeBy = view.getUint16(at + 4, true);
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const compressedSize = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const attributes = view.getUint32(at + 38, true);
    const start = view.getUint32(at + 42, true);
    const next = at + CENTRAL_SIZE + nameLength + extraLength + commentLength;
    if (next > centralOffset + centralSize) return fail("the central directory is truncated");
    const raw = decodeName(
      bytes.subarray(at + CENTRAL_SIZE, at + CENTRAL_SIZE + nameLength),
      (flags & UTF8_FLAG) !== 0,
    );
    at = next;

    const shown = displayName(raw);
    const skip = (code: SkipCode, reason: string) => skipped.push({ path: shown, code, reason });
    const isDirectory = /[/\\]$/.test(raw);
    const isSymlink = madeBy >>> 8 === UNIX && ((attributes >>> 16) & S_IFMT) === S_IFLNK;

    const safe = safePath(raw);
    if ("unsafe" in safe) {
      if (!(isDirectory && safe.unsafe === "empty name")) skip("zip.unsafe-path", safe.unsafe);
      continue;
    }
    if (isSymlink) {
      skip("zip.symlink", "symbolic link");
      continue;
    }
    if (isDirectory) continue;
    if (isMetadata(safe.path)) {
      skip("zip.metadata", "operating system metadata");
      continue;
    }
    if ((flags & ENCRYPTED_FLAGS) !== 0) {
      skip("zip.encrypted", "encrypted");
      continue;
    }
    if (method !== 0 && method !== 8) {
      skip("zip.unsupported-method", `compression method ${method} is not supported`);
      continue;
    }
    if (seen.has(safe.path)) {
      skip("zip.duplicate-entry", "another entry has the same name");
      continue;
    }
    seen.add(safe.path);
    if (size > limits.maxEntryBytes) {
      skip("zip.entry-too-large", `${size} bytes; the limit is ${limits.maxEntryBytes}`);
      continue;
    }
    if (size > RATIO_THRESHOLD_BYTES && size > limits.maxCompressionRatio * compressedSize) {
      const ratio = compressedSize === 0 ? "unbounded" : `${Math.round(size / compressedSize)}:1`;
      skip("zip.compression-ratio", `expands ${ratio}, which looks like a ZIP bomb`);
      continue;
    }

    if (start + LOCAL_SIZE > centralOffset || view.getUint32(start, true) !== LOCAL_SIGNATURE) {
      skip("zip.corrupt-entry", "its local header is missing");
      continue;
    }
    const dataStart =
      start + LOCAL_SIZE + view.getUint16(start + 26, true) + view.getUint16(start + 28, true);
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > centralOffset) {
      skip("zip.corrupt-entry", "its data is out of bounds");
      continue;
    }
    candidates.push({
      path: safe.path,
      raw: shown,
      method,
      crc,
      compressedSize,
      size,
      start,
      dataStart,
      dataEnd,
    });
  }

  // Entries that share bytes are the "overlapping files" ZIP bomb: a small archive whose
  // entries all point at the same compressed data. A real export never does this.
  const overlapping = new Set<Candidate>();
  const byOffset = [...candidates].sort((a, b) => a.start - b.start);
  let reach = -1;
  for (const c of byOffset) {
    if (c.start < reach) overlapping.add(c);
    else reach = c.dataEnd;
  }

  const files: ZipFile[] = [];
  let total = 0;
  for (const c of candidates) {
    const skip = (code: SkipCode, reason: string) => skipped.push({ path: c.raw, code, reason });
    if (overlapping.has(c)) {
      skip("zip.overlapping-entry", "shares its data with another entry");
      continue;
    }
    if (total + c.size > limits.maxTotalBytes) {
      skip("zip.size-limit", `the archive's ${limits.maxTotalBytes}-byte limit was reached`);
      continue;
    }
    const data = bytes.subarray(c.dataStart, c.dataEnd);
    let content: Uint8Array;
    if (c.method === 0) {
      if (c.compressedSize !== c.size) {
        skip("zip.corrupt-entry", "its stored size does not match its header");
        continue;
      }
      content = data;
    } else {
      try {
        // The output may never exceed the declared size, so a lying header cannot inflate memory.
        content = inflateRawSync(data, { maxOutputLength: Math.max(c.size, 1) });
      } catch {
        skip("zip.corrupt-entry", "its data does not decompress to the size in its header");
        continue;
      }
      if (content.byteLength !== c.size) {
        skip("zip.corrupt-entry", "its data does not decompress to the size in its header");
        continue;
      }
    }
    if (crc32(content) >>> 0 !== c.crc) {
      skip("zip.corrupt-entry", "its checksum does not match");
      continue;
    }
    total += c.size;
    files.push({ path: c.path, bytes: content });
  }
  return { ok: true, files, skipped };
}
