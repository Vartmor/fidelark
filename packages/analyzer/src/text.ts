/**
 * Returns a function mapping a character index in `text` to a 1-based line number,
 * offset by the line where `text` starts. Uses binary search, so large inputs stay fast.
 */
export function lineLookup(text: string, startLine = 1): (index: number) => number {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return (index) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((starts[mid] as number) <= index) lo = mid;
      else hi = mid - 1;
    }
    return startLine + lo;
  };
}

/** Keeps long values such as data: URIs readable in reports. */
export function truncate(value: string, max = 120): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Lists up to `max` items and summarizes the rest, for finding evidence. */
export function capList(items: readonly string[], max = 10): string[] {
  if (items.length <= max) return [...items];
  return [...items.slice(0, max), `… and ${items.length - max} more`];
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
