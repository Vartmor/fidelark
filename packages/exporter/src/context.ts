import { redactSecrets } from "@fidelark/analyzer";
import type { BundledResource, DependencyKind, SkippedResource } from "@fidelark/schema";
import { LoadError } from "./errors.ts";
import type { LoadedResource, Loader } from "./loader.ts";

/**
 * Position of a reference in the document: `[element]`, `[element, candidate]` or, inside
 * stylesheets, `[element, offset, offset, ...]`. Records are sorted by it, so manifests list
 * resources in document order no matter which download finishes first.
 */
export type Order = readonly number[];

type Entry<T> = { order: Order; value: T };

const compareOrder = (a: Order, b: Order): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = (a[i] as number) - (b[i] as number);
    if (d !== 0) return d;
  }
  return a.length - b.length;
};

/** Shared state for one export: loader, size budget and the record of what happened. */
export class ExportContext {
  readonly loader: Loader;
  /** Root for root-relative paths (`/img/a.png`) in local documents. */
  readonly root: URL | undefined;
  private readonly maxTotalBytes: number;
  private readonly bundledEntries: Entry<BundledResource>[] = [];
  private readonly skippedEntries: Entry<SkippedResource>[] = [];
  private used = 0;

  constructor(loader: Loader, maxTotalBytes: number, root?: URL) {
    this.loader = loader;
    this.maxTotalBytes = maxTotalBytes;
    this.root = root;
  }

  /** Loads a resource for embedding, enforcing the total size budget. Returns null on failure. */
  async embed(
    kind: DependencyKind,
    specifier: string,
    url: URL,
    order: Order,
  ): Promise<LoadedResource | null> {
    try {
      const res = await this.loader(url);
      if (this.used + res.bytes.byteLength > this.maxTotalBytes) {
        this.skip(
          kind,
          specifier,
          `total export size limit of ${this.maxTotalBytes} bytes reached`,
          true,
          order,
        );
        return null;
      }
      this.used += res.bytes.byteLength;
      this.bundledEntries.push({
        order,
        value: {
          kind,
          specifier: label(specifier),
          from: res.from,
          mediaType: res.mediaType,
          bytes: res.bytes.byteLength,
          sha256: res.sha256,
        },
      });
      return res;
    } catch (error) {
      const reason =
        error instanceof LoadError ? error.message : `unexpected error: ${String(error)}`;
      // Not being allowed to use the network is a choice, not a failure.
      this.skip(kind, specifier, reason, !reason.startsWith("network access not allowed"), order);
      return null;
    }
  }

  /** Undoes an `embed` record, e.g. when an integrity check rejects the content. */
  reject(kind: DependencyKind, specifier: string, reason: string, order: Order) {
    const index = this.bundledEntries.findIndex((e) => compareOrder(e.order, order) === 0);
    if (index >= 0) {
      const [removed] = this.bundledEntries.splice(index, 1);
      this.used -= removed?.value.bytes ?? 0;
    }
    this.skip(kind, specifier, reason, true, order);
  }

  skip(kind: DependencyKind, specifier: string, reason: string, failed: boolean, order: Order) {
    this.skippedEntries.push({
      order,
      value: { kind, specifier: label(specifier), reason, failed },
    });
  }

  get bundled(): BundledResource[] {
    return sorted(this.bundledEntries);
  }

  get skipped(): SkippedResource[] {
    return sorted(this.skippedEntries);
  }

  get totalBytes() {
    return this.used;
  }
}

const sorted = <T>(entries: Entry<T>[]) =>
  [...entries].sort((a, b) => compareOrder(a.order, b.order)).map((e) => e.value);

/** Specifiers as recorded in manifests: credentials redacted, long data kept short. */
export function label(specifier: string): string {
  const s = redactSecrets(specifier.trim());
  return s.length > 200 ? `${s.slice(0, 199)}…` : s;
}
