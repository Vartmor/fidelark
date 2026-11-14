import type { DependencyLocation } from "@fidelark/schema";

const IGNORED_SCHEMES = new Set(["about", "blob", "javascript", "mailto", "tel", "sms"]);

/**
 * Classifies a reference by where it lives. Returns null for references that are not
 * dependencies (fragments, about:blank, javascript:, mailto:, ...).
 * With `module: true`, a name like "react" is a bare module specifier, not a relative path.
 */
export function classifySpecifier(
  specifier: string,
  { module = false }: { module?: boolean } = {},
): DependencyLocation | null {
  const spec = specifier.trim();
  if (spec === "" || spec.startsWith("#")) return null;
  if (spec.startsWith("//")) return "remote";

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(spec)?.[1]?.toLowerCase();
  if (scheme !== undefined) {
    if (scheme === "data") return "embedded";
    if (IGNORED_SCHEMES.has(scheme)) return null;
    return "remote";
  }
  if (module && !/^(\.{0,2}\/)/.test(spec)) return "bare";
  return "relative";
}

const isSpace = (c: string | undefined) =>
  c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";

/**
 * Returns the URLs in a srcset attribute, following the HTML parsing rules: a URL runs until
 * whitespace (so it may contain commas), and descriptors run until the next comma.
 */
export function srcsetUrls(srcset: string): string[] {
  const urls: string[] = [];
  let i = 0;
  while (i < srcset.length) {
    while (i < srcset.length && (isSpace(srcset[i]) || srcset[i] === ",")) i++;
    const start = i;
    while (i < srcset.length && !isSpace(srcset[i])) i++;
    let url = srcset.slice(start, i);
    const endsCandidate = url.endsWith(",");
    url = url.replace(/,+$/, "");
    if (url !== "") urls.push(url);
    if (endsCandidate) continue;
    let depth = 0;
    while (i < srcset.length) {
      const c = srcset[i++];
      if (c === "(") depth++;
      else if (c === ")") depth = Math.max(0, depth - 1);
      else if (c === "," && depth === 0) break;
    }
  }
  return urls;
}

export function isJavascriptUrl(value: string): boolean {
  return /^\s*javascript:/i.test(value);
}
