import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { LoadError } from "./errors.ts";

export type RemoteOptions = {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects: number;
  userAgent: string;
  /** Only for tests against a local server. Never exposed in the CLI. */
  allowPrivateAddresses?: boolean;
};

export type RemoteResponse = {
  bytes: Buffer;
  contentType: string | null;
  finalUrl: URL;
};

/** Addresses an artifact must never make the exporter contact (loopback, LAN, metadata services, ...). */
const NON_PUBLIC = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  NON_PUBLIC.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  NON_PUBLIC.addSubnet(net, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !NON_PUBLIC.check(address, "ipv4");
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
    if (mapped) return !NON_PUBLIC.check(mapped, "ipv4");
    return !NON_PUBLIC.check(address, "ipv6");
  }
  return false;
}

/**
 * DNS lookup that refuses non-public addresses. It runs inside the connection itself, so a
 * hostname cannot resolve to a public address for a check and a private one for the request.
 */
function guardedLookup(allowPrivate: boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) return callback(error, "", 0);
      const list = addresses as LookupAddress[];
      const blocked = list.find((a) => !allowPrivate && !isPublicAddress(a.address));
      if (blocked) {
        return callback(new LoadError(`refused non-public address ${blocked.address}`), "", 0);
      }
      if (options.all) return callback(null, list as never, 0);
      const first = list[0];
      if (!first) return callback(new LoadError("no address"), "", 0);
      return callback(null, first.address, first.family);
    });
  };
}

function requestOnce(url: URL, options: RemoteOptions): Promise<http.IncomingMessage> {
  const literal = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(literal) && !options.allowPrivateAddresses && !isPublicAddress(literal)) {
    return Promise.reject(new LoadError(`refused non-public address ${literal}`));
  }
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, {
      headers: { "user-agent": options.userAgent, accept: "*/*", "accept-encoding": "identity" },
      lookup: guardedLookup(options.allowPrivateAddresses === true),
      timeout: options.timeoutMs,
    });
    req.on("response", resolve);
    req.on("timeout", () => req.destroy(new LoadError(`timed out after ${options.timeoutMs} ms`)));
    req.on("error", (error) =>
      reject(error instanceof LoadError ? error : new LoadError(error.message)),
    );
  });
}

function readBody(res: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes) {
    res.destroy();
    return Promise.reject(new LoadError(`larger than the ${maxBytes}-byte limit`));
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    res.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        res.destroy();
        reject(new LoadError(`larger than the ${maxBytes}-byte limit`));
        return;
      }
      chunks.push(chunk);
    });
    res.on("end", () => resolve(Buffer.concat(chunks)));
    res.on("error", (error) => reject(new LoadError(error.message)));
  });
}

/**
 * Downloads one public http(s) resource with limits on size, time and redirects.
 * Only ever called when the user explicitly allowed network access.
 */
export async function fetchRemote(url: URL, options: RemoteOptions): Promise<RemoteResponse> {
  let current = url;
  for (let redirects = 0; ; redirects++) {
    if (current.protocol !== "https:" && current.protocol !== "http:") {
      throw new LoadError(`unsupported protocol ${current.protocol}`);
    }
    const res = await requestOnce(current, options);
    const status = res.statusCode ?? 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      if (redirects >= options.maxRedirects) throw new LoadError("too many redirects");
      current = new URL(res.headers.location, current);
      continue;
    }
    if (status !== 200) {
      res.resume();
      throw new LoadError(`HTTP ${status}`);
    }
    const bytes = await readBody(res, options.maxBytes);
    return { bytes, contentType: res.headers["content-type"] ?? null, finalUrl: current };
  }
}
