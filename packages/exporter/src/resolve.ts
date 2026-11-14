const NOT_A_RESOURCE = /^\s*(#|data:|javascript:|about:|blob:|mailto:|tel:)/i;

/**
 * Resolves a reference against a base URL. Returns null for references that are not loadable
 * resources (fragments, data:, javascript:, ...). Protocol-relative URLs become https, and
 * root-relative paths in a local document resolve against `root` instead of the filesystem root.
 */
export function resolveReference(specifier: string, base: URL, root?: URL): URL | null {
  const spec = specifier.trim();
  if (spec === "" || NOT_A_RESOURCE.test(spec)) return null;
  try {
    if (spec.startsWith("//")) return new URL(`https:${spec}`);
    if (base.protocol === "file:" && spec.startsWith("/") && root) return new URL(`.${spec}`, root);
    return new URL(spec, base);
  } catch {
    return null;
  }
}
