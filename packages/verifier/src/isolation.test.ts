import { createSocket, type Socket as UdpSocket } from "node:dgram";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findBrowser, isolationArgs, runInBrowser } from "./browser.ts";
import { BROWSER_TEST_TIMEOUT } from "./testing.ts";

/**
 * Sandbox escape tests (docs/adr/0002). A listener on this machine stands in for an attacker's
 * server; every page tries to reach it, and nothing may arrive. Loopback is used because a
 * machine may have no other interface; the browser is told to treat loopback like any host.
 */

describe("isolationArgs", () => {
  it("routes everything through the dead-end proxy and resolves no hostnames", () => {
    expect(isolationArgs(4321)).toEqual([
      "--proxy-server=http://127.0.0.1:4321",
      "--proxy-bypass-list=<-loopback>",
      "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1",
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
    ]);
  });
});

const browserPath = await findBrowser();

describe.skipIf(browserPath === null)("verify browser isolation", () => {
  let dir: string;
  let tcp: Server;
  let udp: UdpSocket;
  let port = 0;
  let udpPort = 0;
  const arrived: string[] = [];

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "fidelark-isolation-"));
    tcp = createServer((socket) => {
      arrived.push("tcp");
      socket.destroy();
    });
    await new Promise<void>((resolve) => tcp.listen(0, "127.0.0.1", resolve));
    port = (tcp.address() as { port: number }).port;
    udp = createSocket("udp4");
    udp.on("message", () => arrived.push("udp"));
    await new Promise<void>((resolve) => udp.bind(0, "127.0.0.1", resolve));
    udpPort = udp.address().port;
  });
  afterAll(async () => {
    tcp.close();
    udp.close();
    await rm(dir, { recursive: true, force: true });
  });

  async function open(name: string, html: string) {
    const path = join(dir, `${name}.html`);
    await writeFile(path, `<!doctype html>${html}`);
    const before = arrived.length;
    const result = await runInBrowser(pathToFileURL(path), {
      executablePath: browserPath as string,
      sandbox: true,
      timeoutMs: 10_000,
      settleMs: 1_500,
    });
    // Give late connections time to land before counting.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { result, leaked: arrived.slice(before) };
  }

  it(
    "lets nothing out: requests, sockets, beacons, workers, prefetch, prerender, WebRTC",
    async () => {
      const at = `http://127.0.0.1:${port}`;
      const { result, leaked } = await open(
        "everything",
        [
          `<link rel="preconnect" href="${at}"><link rel="dns-prefetch" href="//leak.example.com">`,
          `<link rel="prefetch" href="${at}/prefetch"><link rel="stylesheet" href="${at}/style.css">`,
          `<script type="speculationrules">{"prerender":[{"source":"list","urls":["${at}/prerender"]}],"prefetch":[{"source":"list","urls":["${at}/speculative"]}]}</script>`,
          `<p>Still here</p><img src="${at}/pixel.png"><iframe src="${at}/frame"></iframe>`,
          "<script>",
          `fetch("${at}/fetch").catch(() => {});`,
          `fetch("file:///etc/hostname").catch(() => {});`,
          `navigator.sendBeacon("${at}/beacon", "data");`,
          `new EventSource("${at}/events");`,
          `new WebSocket("ws://127.0.0.1:${port}/socket");`,
          `new Worker(URL.createObjectURL(new Blob(['fetch("${at}/worker").catch(() => {})'])));`,
          `window.open("${at}/popup");`,
          `const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:127.0.0.1:${udpPort}" },`,
          `  { urls: "turn:127.0.0.1:${port}?transport=tcp", username: "u", credential: "p" }] });`,
          `pc.createDataChannel("d"); pc.createOffer().then((o) => pc.setLocalDescription(o));`,
          `addEventListener("pagehide", () => navigator.sendBeacon("${at}/unload", "bye"));`,
          "</script>",
        ].join("\n"),
      );
      expect(leaked).toEqual([]);
      expect(result.loaded).toBe(true);
      expect(result.blockedRequests).toEqual(
        expect.arrayContaining([
          `${at}/fetch`,
          `${at}/beacon`,
          `ws://127.0.0.1:${port}/socket`,
          `${at}/worker`,
          "file:///etc/hostname",
        ]),
      );
    },
    BROWSER_TEST_TIMEOUT,
  );

  it.each([
    ["location", `<p>x</p><script>location.href = "http://127.0.0.1:PORT/away"</script>`],
    [
      "meta refresh",
      `<meta http-equiv="refresh" content="0;url=http://127.0.0.1:PORT/away"><p>x</p>`,
    ],
    [
      "form submit",
      `<form action="http://127.0.0.1:PORT/away" method="post"><input name="a" value="secret"></form><p>x</p><script>document.forms[0].submit()</script>`,
    ],
  ])(
    "blocks a %s that leaves the file and does not count the error page as loaded",
    async (name, html) => {
      const { result, leaked } = await open(
        name.replace(" ", "-"),
        html.replace("PORT", String(port)),
      );
      expect(leaked).toEqual([]);
      expect(result.loaded).toBe(false);
      expect(result.renderedTextChars).toBe(0);
      expect(result.pageErrors).toContain(
        "the page tried to leave the file; the navigation was blocked",
      );
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "reports a page that never stops running instead of waiting for it",
    async () => {
      const started = Date.now();
      const { result } = await open(
        "hang",
        "<p>x</p><script>setTimeout(() => { for (;;) {} }, 50)</script>",
      );
      expect(Date.now() - started).toBeLessThan(25_000);
      expect(result.loaded).toBe(false);
      expect(result.pageErrors).toContain("the page stopped responding (a script kept running)");
    },
    BROWSER_TEST_TIMEOUT,
  );
});
