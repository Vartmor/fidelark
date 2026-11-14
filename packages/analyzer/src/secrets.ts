import { lineLookup } from "./text.ts";

export type SecretHit = {
  kind: string;
  line: number;
  /** Redacted preview; the full value never leaves this module. */
  preview: string;
};

/** High-signal credential formats. Order matters: more specific patterns first. */
const PATTERNS: readonly (readonly [string, RegExp])[] = [
  ["Anthropic API key", /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
  ["OpenAI API key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/g],
  ["AWS access key ID", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}/g],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
  ["Stripe secret key", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g],
  ["Private key", /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g],
  ["Bearer token", /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g],
];

/** Query parameters whose values are usually credentials. */
const CREDENTIAL_PARAM =
  /([?&](?:api[_-]?key|apikey|key|token|access[_-]?token|auth|secret|client[_-]?secret|password|sig|signature)=)([^&#\s"'`]+)/gi;

function preview(kind: string, value: string): string {
  if (kind === "Private key") return "PRIVATE KEY block";
  return `${value.slice(0, 4)}… (${value.length} chars)`;
}

/** Finds likely credentials in `text`. Reports are shareable, so only redacted previews are kept. */
export function findSecrets(text: string): SecretHit[] {
  const lineOf = lineLookup(text);
  const taken: [number, number][] = [];
  const hits: (SecretHit & { index: number })[] = [];
  const overlaps = (start: number, end: number) => taken.some(([s, e]) => start < e && end > s);

  for (const [kind, pattern] of PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (overlaps(start, end)) continue;
      taken.push([start, end]);
      hits.push({ kind, index: start, line: lineOf(start), preview: preview(kind, match[0]) });
    }
  }
  for (const match of text.matchAll(CREDENTIAL_PARAM)) {
    const value = match[2] ?? "";
    const start = match.index + (match[1]?.length ?? 0);
    if (value.length < 8 || overlaps(start, start + value.length)) continue;
    const param = (match[1] ?? "").slice(1, -1);
    hits.push({
      kind: `credential in URL parameter "${param}"`,
      index: start,
      line: lineOf(start),
      preview: preview("", value),
    });
  }
  return hits.sort((a, b) => a.index - b.index).map(({ index: _index, ...hit }) => hit);
}

/** Replaces credentials in a string (for specifiers and evidence) with a redaction marker. */
export function redactSecrets(text: string): string {
  let out = text;
  for (const [kind, pattern] of PATTERNS) {
    out = out.replace(pattern, `[redacted ${kind}]`);
  }
  return out.replace(CREDENTIAL_PARAM, (_m, prefix: string, value: string) =>
    value.length < 8 ? `${prefix}${value}` : `${prefix}[redacted]`,
  );
}
