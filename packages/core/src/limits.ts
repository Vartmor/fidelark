/** Input limits applied before any parsing. */
export type Limits = {
  /** Inputs larger than this are not read at all. Also the limit for one file in a ZIP. */
  maxInputBytes: number;
  /** ZIP input: archives with more entries are not read. */
  maxArchiveEntries?: number;
  /** ZIP input: uncompressed size of all files together. */
  maxArchiveBytes?: number;
  /** ZIP input: files over 1 MiB that expand more than this are treated as ZIP bombs. */
  maxCompressionRatio?: number;
};

export const DEFAULT_LIMITS: Required<Limits> = {
  maxInputBytes: 25 * 1024 * 1024,
  maxArchiveEntries: 5_000,
  maxArchiveBytes: 100 * 1024 * 1024,
  maxCompressionRatio: 100,
};
