import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import { redactSecrets } from "@fidelark/analyzer";
import type { BrowserCheck } from "@fidelark/schema";

const CANDIDATES: Record<string, string[]> = {
  linux: [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
    "/usr/bin/microsoft-edge",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
};

/** Finds an installed Chromium-based browser; `FIDELARK_BROWSER` overrides the search. */
export async function findBrowser(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const candidates = env.FIDELARK_BROWSER
    ? [env.FIDELARK_BROWSER]
    : (CANDIDATES[process.platform] ?? []);
  for (const path of candidates) {
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export class BrowserLaunchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserLaunchError";
  }
}

export type BrowserRunOptions = {
  executablePath: string;
  sandbox: boolean;
  timeoutMs: number;
  settleMs: number;
};

const clean = (text: string) => {
  const s = redactSecrets(text.replace(/\s+/g, " ").trim());
  return s.length > 300 ? `${s.slice(0, 299)}…` : s;
};
const unique = (items: string[]) => [...new Set(items)];

/**
 * A local dead end that Chromium must use as its proxy. Request routing (below) blocks what
 * pages request, but some traffic never passes through it: speculative prefetch and prerender,
 * and the connections Chromium opens ahead of a navigation. Through the proxy, all of that ends
 * here. Nothing is forwarded; the target of each proxied request is recorded as blocked.
 */
async function startSink(record: (target: string) => void) {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.setTimeout(2_000, () => socket.destroy());
    socket.once("data", (chunk: Buffer) => {
      const line = chunk.subarray(0, 2048).toString("latin1").split("\r\n")[0] ?? "";
      const request = /^([A-Z]+) (\S+) HTTP\/\d/.exec(line);
      if (request?.[2]) {
        record(
          request[1] === "CONNECT" ? `https://${request[2].replace(/:443$/, "")}` : request[2],
        );
      }
      socket.destroy();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

/** Isolation flags for the browser process; see docs/adr/0002. */
export function isolationArgs(proxyPort: number): string[] {
  return [
    `--proxy-server=http://127.0.0.1:${proxyPort}`,
    // Chromium sends loopback addresses past the proxy unless told otherwise.
    "--proxy-bypass-list=<-loopback>",
    // No hostname is ever resolved: a DNS lookup can carry data even when the request is blocked.
    "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1",
    // WebRTC may only use the proxy, so no UDP leaves the machine.
    "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
  ];
}

/** Resolves to `fallback` if `promise` takes longer than `ms`; used where a page can stall. */
function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  promise.catch(() => {});
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

/**
 * Opens a local HTML file in a headless browser with every network request and WebSocket
 * blocked, other local files blocked, no permissions, no service workers and no downloads,
 * then records what the page tried to load and which errors it raised. Below the request
 * routing, the browser itself can reach nothing: its proxy is a local dead end, it resolves no
 * hostnames, and WebRTC cannot send UDP. A page that navigates away, hangs or crashes is
 * reported, never waited on forever.
 */
export async function runInBrowser(
  fileUrl: URL,
  options: BrowserRunOptions,
): Promise<BrowserCheck> {
  const { chromium } = await import("playwright-core");
  const blocked: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const target = fileUrl.href.split("#")[0];
  const sink = await startSink((url) => blocked.push(clean(url)));
  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    browser = await chromium.launch({
      executablePath: options.executablePath,
      headless: true,
      chromiumSandbox: options.sandbox,
      timeout: options.timeoutMs,
      args: isolationArgs(sink.port),
    });
  } catch (error) {
    await sink.close();
    throw new BrowserLaunchError(
      String(error instanceof Error ? error.message : error).split("\n")[0] ?? "launch failed",
    );
  }

  try {
    const context = await browser.newContext({
      offline: true,
      serviceWorkers: "block",
      acceptDownloads: false,
      permissions: [],
    });
    await context.route("**/*", (route) => {
      const url = route.request().url();
      const allowed =
        url.split("#")[0] === target ||
        url.startsWith("data:") ||
        url.startsWith("blob:") ||
        url.startsWith("about:");
      if (allowed) return route.continue();
      blocked.push(clean(url));
      return route.abort("internetdisconnected");
    });
    await context.routeWebSocket(/.*/, (ws) => {
      blocked.push(clean(ws.url()));
      return ws.close();
    });
    const page = await context.newPage();
    // Popups and new windows opened by the page are closed immediately.
    context.on("page", (other) => {
      if (other !== page) void other.close();
    });
    page.on("pageerror", (error) => pageErrors.push(clean(error.message)));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      // Blocked requests are already listed; the browser repeats them as console errors.
      if (/^Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_FAILED/.test(text)) return;
      consoleErrors.push(clean(text));
    });
    page.on("dialog", (dialog) => {
      void dialog.dismiss().catch(() => {});
    });
    page.on("crash", () => pageErrors.push("the page crashed"));
    // The file may redirect itself (location, meta refresh, form submit). The navigation is
    // blocked, so the browser would show its own error page, whose text must not count.
    let leftTo: string | null = null;
    page.on("framenavigated", (frame) => {
      if (frame !== page.mainFrame()) return;
      const url = frame.url().split("#")[0] ?? "";
      if (url !== target && leftTo === null) leftTo = url;
    });

    let loaded = true;
    try {
      await page.goto(fileUrl.href, { waitUntil: "load", timeout: options.timeoutMs });
      await page.waitForTimeout(options.settleMs);
    } catch (error) {
      loaded = false;
      pageErrors.push(
        clean(
          `page did not finish loading: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
    if (leftTo !== null) {
      loaded = false;
      pageErrors.push(
        (leftTo as string).startsWith("chrome-error:")
          ? "the page tried to leave the file; the navigation was blocked"
          : clean(`the page left the file for ${leftTo}`),
      );
    }
    let renderedTextChars = 0;
    if (loaded) {
      // A script that never yields (an endless loop after load) must not stall verification.
      const measured = await within(
        page
          .evaluate('document.body ? document.body.innerText.replace(/\\s+/g, "").length : 0')
          .then(Number),
        Math.min(options.timeoutMs, 5_000),
        null,
      );
      if (measured === null) {
        loaded = false;
        pageErrors.push("the page stopped responding (a script kept running)");
      } else renderedTextChars = measured;
    }

    return {
      browser: `Chromium ${browser.version()}`,
      sandboxed: options.sandbox,
      loaded,
      renderedTextChars,
      blockedRequests: unique(blocked),
      pageErrors: unique(pageErrors),
      consoleErrors: unique(consoleErrors),
    };
  } finally {
    await within(browser.close(), 10_000, undefined);
    await sink.close();
  }
}
