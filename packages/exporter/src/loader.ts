import { createHash } from "node:crypto";
import { open, realpath } from "node:fs/promises";
import { sep } from "node:path";
import { fileURLToPath } from "node:url";
import { LoadError } from "./errors.ts";
import { mediaTypeOf } from "./mime.ts";
import { fetchRemote, type RemoteOptions } from "./net.ts";

export type LoadedResource = {
  bytes: Uint8Array;
  mediaType: string;
  /** Where the bytes came from; remote resources may have been redirected. */
  url: URL;
  from: "local" | "remote";
  sha256: string;
};

export type Loader = (url: URL) => Promise<LoadedResource>;

/** In-memory files, such as a ZIP export, served for `file:` URLs under `root`. */
export type ArchiveSource = {
  root: URL;
  read(path: string): Uint8Array | undefined;
};

export type LoaderOptions = {
  /** Local files are only read from inside this directory. */
  baseDir?: string;
  /** When set, local files come only from these files; the disk is never read. */
  archive?: ArchiveSource;
  /** Remote resources are only downloaded when this is true. */
  allowNetwork: boolean;
  maxResourceBytes: number;
  remote: Omit<RemoteOptions, "maxBytes">;
  /** Replaces the network client, e.g. in tests. */
  fetchRemote?: typeof fetchRemote;
};

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function readLocal(url: URL, baseDir: string, maxBytes: number): Promise<Uint8Array> {
  let path: string;
  try {
    path = await realpath(fileURLToPath(url));
  } catch {
    throw new LoadError("file not found");
  }
  const root = await realpath(baseDir);
  if (path !== root && !path.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)) {
    throw new LoadError("outside the base directory");
  }
  const handle = await open(path, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new LoadError("not a regular file");
    if (stat.size > maxBytes) throw new LoadError(`larger than the ${maxBytes}-byte limit`);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function readArchive(url: URL, archive: ArchiveSource, maxBytes: number): Uint8Array {
  if (!url.pathname.startsWith(archive.root.pathname)) throw new LoadError("outside the archive");
  let path: string;
  try {
    path = url.pathname
      .slice(archive.root.pathname.length)
      .split("/")
      .map(decodeURIComponent)
      .join("/");
  } catch {
    throw new LoadError("file not found in the archive");
  }
  const bytes = archive.read(path);
  if (bytes === undefined) throw new LoadError("file not found in the archive");
  if (bytes.byteLength > maxBytes) throw new LoadError(`larger than the ${maxBytes}-byte limit`);
  return bytes;
}

/**
 * Creates a loader that reads local files confined to `baseDir`, or only from `archive`, and,
 * only when allowed, downloads public http(s) resources. Results are cached per URL.
 */
export function createLoader(options: LoaderOptions): Loader {
  const cache = new Map<string, Promise<LoadedResource>>();
  const fetcher = options.fetchRemote ?? fetchRemote;
  const remote = limitConcurrency(fetcher, 6);

  const load = async (url: URL): Promise<LoadedResource> => {
    if (url.protocol === "file:") {
      let bytes: Uint8Array;
      if (options.archive) bytes = readArchive(url, options.archive, options.maxResourceBytes);
      else if (options.baseDir !== undefined)
        bytes = await readLocal(url, options.baseDir, options.maxResourceBytes);
      else throw new LoadError("local files are not allowed");
      return { bytes, mediaType: mediaTypeOf(url, null), url, from: "local", sha256: hash(bytes) };
    }
    if (url.protocol === "http:" || url.protocol === "https:") {
      if (!options.allowNetwork)
        throw new LoadError("network access not allowed (use --allow-network)");
      const res = await remote(url, { ...options.remote, maxBytes: options.maxResourceBytes });
      return {
        bytes: res.bytes,
        mediaType: mediaTypeOf(res.finalUrl, res.contentType),
        url: res.finalUrl,
        from: "remote",
        sha256: hash(res.bytes),
      };
    }
    throw new LoadError(`unsupported protocol ${url.protocol}`);
  };

  return (url) => {
    const key = url.href;
    let pending = cache.get(key);
    if (!pending) {
      pending = load(url);
      cache.set(key, pending);
    }
    return pending;
  };
}

/** Runs at most `max` calls of `fn` at once; the rest wait their turn. */
function limitConcurrency<A extends unknown[], R>(fn: (...args: A) => Promise<R>, max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async (...args: A): Promise<R> => {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await fn(...args);
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}
