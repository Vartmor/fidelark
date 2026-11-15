import { crc32, deflateRawSync } from "node:zlib";

/**
 * Test helper: writes small ZIP archives, including deliberately broken or malicious ones.
 * Archives are deterministic (fixed timestamps), so fixtures built with it keep their hashes.
 */
export type ZipSpec = {
  name: string;
  content?: string | Uint8Array;
  /** 0 = stored, 8 = deflate (default). Other values are written as-is with stored data. */
  method?: number;
  flags?: number;
  /** Unix mode in the external attributes, e.g. 0o120777 for a symbolic link. */
  unixMode?: number;
  /** Header overrides for broken archives. */
  crc?: number;
  size?: number;
  /** Point this entry at the data of an earlier entry (index), like an overlapping ZIP bomb. */
  shareDataOf?: number;
};

const UTF8_FLAG = 0x800;
// 2026-11-14 00:00:00 in MS-DOS format.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (11 << 5) | 14;

export function buildZip(
  specs: readonly ZipSpec[],
  options: { comment?: string; entryCount?: number } = {},
): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const spec of specs) {
    const name = encoder.encode(spec.name);
    const raw =
      typeof spec.content === "string"
        ? encoder.encode(spec.content)
        : (spec.content ?? new Uint8Array());
    const method = spec.method ?? 8;
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const crc = spec.crc ?? crc32(raw) >>> 0;
    const size = spec.size ?? raw.byteLength;
    const flags = (spec.flags ?? 0) | UTF8_FLAG;

    let localOffset: number;
    let compressedSize = data.byteLength;
    if (spec.shareDataOf !== undefined) {
      localOffset = offsets[spec.shareDataOf] ?? 0;
      const shared = specs[spec.shareDataOf];
      const sharedRaw =
        typeof shared?.content === "string"
          ? encoder.encode(shared.content)
          : (shared?.content ?? new Uint8Array());
      compressedSize =
        (shared?.method ?? 8) === 8 ? deflateRawSync(sharedRaw).byteLength : sharedRaw.byteLength;
    } else {
      localOffset = offset;
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, flags, true);
      local.setUint16(8, method, true);
      local.setUint16(10, DOS_TIME, true);
      local.setUint16(12, DOS_DATE, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.byteLength, true);
      local.setUint32(22, size, true);
      local.setUint16(26, name.byteLength, true);
      chunks.push(new Uint8Array(local.buffer), name, data);
      offset += 30 + name.byteLength + data.byteLength;
    }
    offsets.push(localOffset);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, (3 << 8) | 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, flags, true);
    entry.setUint16(10, method, true);
    entry.setUint16(12, DOS_TIME, true);
    entry.setUint16(14, DOS_DATE, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, compressedSize, true);
    entry.setUint32(24, size, true);
    entry.setUint16(28, name.byteLength, true);
    const mode = spec.unixMode ?? (spec.name.endsWith("/") ? 0o040755 : 0o100644);
    entry.setUint32(38, (mode << 16) >>> 0, true);
    entry.setUint32(42, localOffset, true);
    central.push(new Uint8Array(entry.buffer), name);
  }

  const centralBytes = central.reduce((sum, c) => sum + c.byteLength, 0);
  const comment = encoder.encode(options.comment ?? "");
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  const count = options.entryCount ?? specs.length;
  end.setUint16(8, count, true);
  end.setUint16(10, count, true);
  end.setUint32(12, centralBytes, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, comment.byteLength, true);

  const parts = [...chunks, ...central, new Uint8Array(end.buffer), comment];
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.byteLength, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
}
