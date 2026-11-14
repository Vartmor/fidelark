/** Input limits applied before any parsing. */
export type Limits = {
  /** Inputs larger than this are not read at all. */
  maxInputBytes: number;
};

export const DEFAULT_LIMITS: Limits = {
  maxInputBytes: 25 * 1024 * 1024,
};
