import { describe, expect, it } from "vitest";
import { buildZip } from "./testing.ts";
import { type ArchiveLimits, displayName, readZip, safePath, type ZipReadResult } from "./zip.ts";

const LIMITS: ArchiveLimits = {
  maxEntries: 100,
  maxEntryBytes: 10 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxCompressionRatio: 100,
};

function ok(result: ZipReadResult) {
  if (!result.ok) throw new Error(`expected a readable archive: ${result.reason}`);
  return result;
}

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const codes = (result: ZipReadResult) => ok(result).skipped.map((s) => s.code);

describe("safePath", () => {
  it("normalizes separators, dots and repeated slashes", () => {
    expect(safePath("site\\css//./main.css")).toEqual({ path: "site/css/main.css" });
  });

  it.each([
    ["../evil.js", "path leaves the archive"],
    ["a/../../b", "path leaves the archive"],
    ["/etc/passwd", "absolute path"],
    ["C:/Windows/win.ini", "absolute path"],
    ["\\\\server\\share", "absolute path"],
    ["red\u001b[31m.txt", "name contains control characters"],
    ["./", "empty name"],
  ])("rejects %j", (name, reason) => {
    expect(safePath(name)).toEqual({ unsafe: reason });
  });

  it("escapes control characters for display", () => {
    expect(displayName("a\u001b[2Jb")).toBe("a\\u001b[2Jb");
  });
});

describe("readZip", () => {
  it("reads stored and deflated files in archive order and skips folders", () => {
    const zip = buildZip([
      { name: "site/", content: "" },
      { name: "site/index.html", content: "<p>hi</p>" },
      { name: "site/data/notes.txt", content: "stored", method: 0 },
      { name: "site/ünïcode.css", content: "p{}" },
    ]);
    const result = ok(readZip(zip, LIMITS));
    expect(result.files.map((f) => [f.path, text(f.bytes)])).toEqual([
      ["site/index.html", "<p>hi</p>"],
      ["site/data/notes.txt", "stored"],
      ["site/ünïcode.css", "p{}"],
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("finds the directory behind an archive comment", () => {
    const zip = buildZip([{ name: "a.txt", content: "a" }], {
      comment: "PK\u0005\u0006 not a record",
    });
    expect(ok(readZip(zip, LIMITS)).files.map((f) => f.path)).toEqual(["a.txt"]);
  });

  it("skips unsafe names, links, metadata, encrypted and unsupported entries", () => {
    const zip = buildZip([
      { name: "index.html", content: "ok" },
      { name: "../outside.js", content: "x" },
      { name: "/abs.txt", content: "x" },
      { name: "esc\u001b[31m.txt", content: "x" },
      { name: "link", content: "/etc/passwd", unixMode: 0o120777 },
      { name: "__MACOSX/._index.html", content: "x" },
      { name: "img/.DS_Store", content: "x" },
      { name: "secret.txt", content: "x", flags: 1 },
      { name: "data.bz2", content: "x", method: 12 },
      { name: "index.html", content: "again" },
    ]);
    const result = ok(readZip(zip, LIMITS));
    expect(result.files.map((f) => [f.path, text(f.bytes)])).toEqual([["index.html", "ok"]]);
    expect(result.skipped).toEqual([
      { path: "../outside.js", code: "zip.unsafe-path", reason: "path leaves the archive" },
      { path: "/abs.txt", code: "zip.unsafe-path", reason: "absolute path" },
      {
        path: "esc\\u001b[31m.txt",
        code: "zip.unsafe-path",
        reason: "name contains control characters",
      },
      { path: "link", code: "zip.symlink", reason: "symbolic link" },
      { path: "__MACOSX/._index.html", code: "zip.metadata", reason: "operating system metadata" },
      { path: "img/.DS_Store", code: "zip.metadata", reason: "operating system metadata" },
      { path: "secret.txt", code: "zip.encrypted", reason: "encrypted" },
      {
        path: "data.bz2",
        code: "zip.unsupported-method",
        reason: "compression method 12 is not supported",
      },
      {
        path: "index.html",
        code: "zip.duplicate-entry",
        reason: "another entry has the same name",
      },
    ]);
  });

  it("stops ZIP bombs by compression ratio before decompressing", () => {
    const zip = buildZip([
      { name: "index.html", content: "ok" },
      { name: "zeros.bin", content: new Uint8Array(5 * 1024 * 1024) },
    ]);
    expect(zip.byteLength).toBeLessThan(20_000);
    const result = ok(readZip(zip, LIMITS));
    expect(result.files.map((f) => f.path)).toEqual(["index.html"]);
    expect(result.skipped[0]?.code).toBe("zip.compression-ratio");
    expect(result.skipped[0]?.reason).toMatch(/expands \d+:1, which looks like a ZIP bomb/);
  });

  it("stops overlapping-entry ZIP bombs", () => {
    const kernel = "x".repeat(1000);
    const zip = buildZip([
      { name: "a.txt", content: kernel },
      { name: "b.txt", content: kernel, shareDataOf: 0 },
      { name: "c.txt", content: kernel, shareDataOf: 0 },
    ]);
    const result = ok(readZip(zip, LIMITS));
    expect(result.files.map((f) => f.path)).toEqual(["a.txt"]);
    expect(codes(readZip(zip, LIMITS))).toEqual(["zip.overlapping-entry", "zip.overlapping-entry"]);
  });

  it("enforces the per-entry and total size limits", () => {
    const limits = { ...LIMITS, maxEntryBytes: 100, maxTotalBytes: 150 };
    const zip = buildZip([
      { name: "big.txt", content: "a".repeat(101), method: 0 },
      { name: "one.txt", content: "b".repeat(80), method: 0 },
      { name: "two.txt", content: "c".repeat(80), method: 0 },
    ]);
    const result = ok(readZip(zip, limits));
    expect(result.files.map((f) => f.path)).toEqual(["one.txt"]);
    expect(codes(readZip(zip, limits))).toEqual(["zip.entry-too-large", "zip.size-limit"]);
  });

  it("never trusts sizes or checksums in the headers", () => {
    const zip = buildZip([
      { name: "short.txt", content: "a".repeat(5000), size: 10 },
      { name: "long.txt", content: "abc", size: 4 },
      { name: "crc.txt", content: "abc", crc: 1 },
      { name: "stored.txt", content: "abc", method: 0, size: 2 },
    ]);
    const result = ok(readZip(zip, LIMITS));
    expect(result.files).toEqual([]);
    expect(result.skipped.map((s) => [s.path, s.reason])).toEqual([
      ["short.txt", "its data does not decompress to the size in its header"],
      ["long.txt", "its data does not decompress to the size in its header"],
      ["crc.txt", "its checksum does not match"],
      ["stored.txt", "its stored size does not match its header"],
    ]);
  });

  it("refuses archives it cannot read safely", () => {
    const zip = buildZip([{ name: "a.txt", content: "a" }]);
    expect(readZip(new Uint8Array([0x50, 0x4b, 3, 4]), LIMITS)).toMatchObject({
      ok: false,
      code: "zip.unreadable",
    });
    expect(readZip(zip.subarray(0, zip.byteLength - 10), LIMITS)).toMatchObject({
      ok: false,
      code: "zip.unreadable",
    });
    expect(readZip(buildZip([], { entryCount: 0xffff }), LIMITS)).toMatchObject({
      ok: false,
      reason: "ZIP64 archives are not supported",
    });
    expect(readZip(zip, { ...LIMITS, maxEntries: 0 })).toMatchObject({
      ok: false,
      code: "zip.too-many-entries",
    });
  });
});
