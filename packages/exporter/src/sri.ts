import { createHash } from "node:crypto";

export type IntegrityResult = "none" | "match" | "mismatch" | "unsupported";

const ALGORITHMS = new Set(["sha256", "sha384", "sha512"]);

/**
 * Checks bytes against a Subresource Integrity attribute (`sha384-<base64> ...`).
 * Per the SRI spec, any matching hash of the strongest listed algorithm is enough.
 */
export function checkIntegrity(integrity: string | undefined, bytes: Uint8Array): IntegrityResult {
  if (integrity === undefined || integrity.trim() === "") return "none";
  const tokens = integrity
    .trim()
    .split(/\s+/)
    .map((t) => /^(sha256|sha384|sha512)-([A-Za-z0-9+/=_-]+)/i.exec(t))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ algorithm: (m[1] as string).toLowerCase(), digest: m[2] as string }))
    .filter((t) => ALGORITHMS.has(t.algorithm));
  if (tokens.length === 0) return "unsupported";

  const strongest = ["sha512", "sha384", "sha256"].find((a) =>
    tokens.some((t) => t.algorithm === a),
  );
  const candidates = tokens.filter((t) => t.algorithm === strongest);
  const actual = createHash(strongest as string)
    .update(bytes)
    .digest("base64");
  const normalize = (d: string) => d.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  return candidates.some((t) => normalize(t.digest) === normalize(actual)) ? "match" : "mismatch";
}
