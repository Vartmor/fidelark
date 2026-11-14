import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LoadError } from "./errors.ts";
import { createLoader } from "./loader.ts";
import { dataUri, mediaTypeOf } from "./mime.ts";
import { fetchRemote, isPublicAddress, type RemoteOptions } from "./net.ts";
import { resolveReference } from "./resolve.ts";
import { checkIntegrity } from "./sri.ts";

describe("isPublicAddress", () => {
  it.each([
    ["8.8.8.8", true],
    ["2606:4700:4700::1111", true],
    ["127.0.0.1", false],
    ["10.1.2.3", false],
    ["172.20.0.1", false],
    ["192.168.1.1", false],
    ["169.254.169.254", false],
    ["100.64.0.1", false],
    ["0.0.0.0", false],
    ["::1", false],
    ["fd00::1", false],
    ["fe80::1", false],
    ["::ffff:127.0.0.1", false],
    ["not-an-ip", false],
  ])("%s → %s", (address, expected) => {
    expect(isPublicAddress(address)).toBe(expected);
  });
});

describe("resolveReference", () => {
  const base = new URL("file:///site/pages/index.html");
  const root = new URL("file:///site/");
  it.each([
    ["app.js", "file:///site/pages/app.js"],
    ["../app.js", "file:///site/app.js"],
    ["/static/app.js", "file:///site/static/app.js"],
    ["//cdn.test/x.js", "https://cdn.test/x.js"],
    ["https://cdn.test/x.js", "https://cdn.test/x.js"],
  ])("%s → %s", (spec, expected) => {
    expect(resolveReference(spec, base, root)?.href).toBe(expected);
  });
  it.each([
    "",
    "#top",
    "data:image/png;base64,AA",
    "javascript:void(0)",
    "about:blank",
    "mailto:x@y.test",
  ])("ignores %j", (spec) => {
    expect(resolveReference(spec, base, root)).toBeNull();
  });
});

describe("checkIntegrity", () => {
  const bytes = new TextEncoder().encode("hello");
  const digest = (alg: string) => createHash(alg).update(bytes).digest("base64");
  it("accepts a matching hash of the strongest algorithm", () => {
    expect(checkIntegrity(`sha256-${digest("sha256")}`, bytes)).toBe("match");
    expect(checkIntegrity(`sha256-AAAA sha512-${digest("sha512")}`, bytes)).toBe("match");
  });
  it("rejects a mismatch and ignores unknown algorithms", () => {
    expect(checkIntegrity("sha384-AAAA", bytes)).toBe("mismatch");
    expect(checkIntegrity(`sha512-AAAA sha256-${digest("sha256")}`, bytes)).toBe("mismatch");
    expect(checkIntegrity("md5-AAAA", bytes)).toBe("unsupported");
    expect(checkIntegrity(undefined, bytes)).toBe("none");
  });
});

describe("media types", () => {
  it("prefers the header, falling back to the extension", () => {
    expect(mediaTypeOf(new URL("https://x.test/a.woff2"), "font/woff2; charset=binary")).toBe(
      "font/woff2",
    );
    expect(mediaTypeOf(new URL("https://x.test/a.png"), "application/octet-stream")).toBe(
      "image/png",
    );
    expect(mediaTypeOf(new URL("file:///a.unknown"), null)).toBe("application/octet-stream");
    expect(dataUri("text/plain", new TextEncoder().encode("hi"))).toBe(
      "data:text/plain;base64,aGk=",
    );
  });
});

describe("fetchRemote", () => {
  let server: Server;
  let origin: string;
  const options: RemoteOptions = {
    maxBytes: 100,
    timeoutMs: 2000,
    maxRedirects: 2,
    userAgent: "fidelark-test",
    allowPrivateAddresses: true,
  };

  beforeAll(async () => {
    server = createServer((req, res) => {
      const path = req.url ?? "/";
      if (path === "/ok")
        return res
          .writeHead(200, { "content-type": "text/css" })
          .end(`ua=${req.headers["user-agent"]}`);
      if (path === "/big")
        return res.writeHead(200, { "content-length": "1000" }).end("x".repeat(1000));
      if (path === "/stream") {
        res.writeHead(200);
        return res.end("y".repeat(500));
      }
      if (path.startsWith("/redirect/")) {
        const n = Number(path.split("/")[2]);
        return res.writeHead(302, { location: n > 0 ? `/redirect/${n - 1}` : "/ok" }).end();
      }
      if (path === "/slow") return; // never answers
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it("downloads with the user agent and content type", async () => {
    const res = await fetchRemote(new URL(`${origin}/ok`), options);
    expect(res.bytes.toString()).toBe("ua=fidelark-test");
    expect(res.contentType).toBe("text/css");
  });

  it("follows a limited number of redirects", async () => {
    expect((await fetchRemote(new URL(`${origin}/redirect/1`), options)).finalUrl.pathname).toBe(
      "/ok",
    );
    await expect(fetchRemote(new URL(`${origin}/redirect/5`), options)).rejects.toThrow(
      "too many redirects",
    );
  });

  it("enforces size limits, status codes and timeouts", async () => {
    await expect(fetchRemote(new URL(`${origin}/big`), options)).rejects.toThrow(/byte limit/);
    await expect(fetchRemote(new URL(`${origin}/stream`), options)).rejects.toThrow(/byte limit/);
    await expect(fetchRemote(new URL(`${origin}/missing`), options)).rejects.toThrow("HTTP 404");
    await expect(
      fetchRemote(new URL(`${origin}/slow`), { ...options, timeoutMs: 200 }),
    ).rejects.toThrow(/timed out/);
  });

  it("refuses loopback and private addresses, by IP or by name", async () => {
    const strict = { ...options, allowPrivateAddresses: false };
    await expect(fetchRemote(new URL(`${origin}/ok`), strict)).rejects.toThrow(
      /non-public address 127\.0\.0\.1/,
    );
    const port = new URL(origin).port;
    await expect(fetchRemote(new URL(`http://localhost:${port}/ok`), strict)).rejects.toThrow(
      /non-public address/,
    );
    await expect(fetchRemote(new URL("ftp://x.test/a"), strict)).rejects.toThrow(
      /unsupported protocol/,
    );
  });
});

describe("createLoader", () => {
  let dir: string;
  let site: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "fidelark-loader-"));
    site = join(dir, "site");
    await mkdir(site);
    await writeFile(join(site, "a.css"), "body{}");
    await writeFile(join(site, "big.png"), "x".repeat(200));
    await writeFile(join(dir, "secret.txt"), "secret");
    await symlink(join(dir, "secret.txt"), join(site, "link.txt"));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const loader = (allowNetwork = false) =>
    createLoader({
      baseDir: site,
      allowNetwork,
      maxResourceBytes: 100,
      remote: { timeoutMs: 1000, maxRedirects: 1, userAgent: "t" },
      fetchRemote: async (url) => ({
        bytes: Buffer.from("remote"),
        contentType: "text/plain",
        finalUrl: url,
      }),
    });
  const at = (...parts: string[]) => pathToFileURL(join(...parts));

  it("reads local files inside the base directory", async () => {
    const res = await loader()(at(site, "a.css"));
    expect(res).toMatchObject({ from: "local", mediaType: "text/css" });
    expect(Buffer.from(res.bytes).toString()).toBe("body{}");
  });

  it("refuses files outside the base directory, including through symlinks", async () => {
    await expect(loader()(at(dir, "secret.txt"))).rejects.toThrow("outside the base directory");
    await expect(loader()(at(site, "link.txt"))).rejects.toThrow("outside the base directory");
    await expect(loader()(at(site, "nope.txt"))).rejects.toThrow("file not found");
    await expect(loader()(at(site, "big.png"))).rejects.toThrow(/byte limit/);
  });

  it("downloads only when network access is allowed", async () => {
    const url = new URL("https://cdn.test/x.js");
    await expect(loader(false)(url)).rejects.toBeInstanceOf(LoadError);
    await expect(loader(false)(url)).rejects.toThrow(/network access not allowed/);
    expect((await loader(true)(url)).from).toBe("remote");
  });
});
