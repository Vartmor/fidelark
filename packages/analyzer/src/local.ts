/**
 * Files that ship with the analyzed document, such as the other files of a ZIP export.
 * Relative references are looked up here instead of being reported as missing.
 */
export type LocalFiles = {
  /** Path of the analyzed document inside the archive, e.g. `site/index.html`. */
  documentPath: string;
  /** Folder that root-relative references (`/img/a.png`) resolve against; "" for the archive root. */
  rootPath: string;
  read(path: string): Uint8Array | undefined;
};

const segmentsOf = (folder: string) => folder.split("/").filter((s) => s !== "");
const folderOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/")));

/**
 * Resolves a relative reference written in the file at `base` to a path inside the archive,
 * the way a browser would resolve it against an extracted copy. Query strings and fragments
 * are dropped and percent-escapes decoded. Returns null when the reference leaves the archive.
 */
export function resolveLocalPath(specifier: string, base: string, root: string): string | null {
  const spec = specifier
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#][\s\S]*$/, "");
  if (spec === "") return null;
  const segments = segmentsOf(spec.startsWith("/") ? root : folderOf(base));
  for (const raw of spec.split("/")) {
    let segment = raw;
    try {
      segment = decodeURIComponent(raw);
    } catch {
      // A malformed escape is kept as written; it simply will not match a file.
    }
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.length > 0 ? segments.join("/") : null;
}
