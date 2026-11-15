/**
 * Applies non-overlapping edits in one pass. Rebuilding the string once per edit would copy it
 * every time, which is quadratic for a large file with many references.
 */
export function spliceAll(
  source: string,
  edits: readonly { start: number; end: number; text: string }[],
): string {
  // Ascending; at one offset an insertion (shorter end) goes before a replacement.
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  const parts: string[] = [];
  let at = 0;
  for (const edit of sorted) {
    parts.push(source.slice(at, edit.start), edit.text);
    at = Math.max(at, edit.end);
  }
  parts.push(source.slice(at));
  return parts.join("");
}
