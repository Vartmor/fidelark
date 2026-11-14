import { constants } from "node:fs";
import { access } from "node:fs/promises";
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
 * Opens a local HTML file in a headless browser with every network request and WebSocket
 * blocked, other local files blocked, no permissions, no service workers and no downloads,
 * then records what the page tried to load and which errors it raised.
 */
export async function runInBrowser(
  fileUrl: URL,
  options: BrowserRunOptions,
): Promise<BrowserCheck> {
  const { chromium } = await import("playwright-core");
  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    browser = await chromium.launch({
      executablePath: options.executablePath,
      headless: true,
      chromiumSandbox: options.sandbox,
      timeout: options.timeoutMs,
    });
  } catch (error) {
    throw new BrowserLaunchError(
      String(error instanceof Error ? error.message : error).split("\n")[0] ?? "launch failed",
    );
  }

  const blocked: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const target = fileUrl.href.split("#")[0];
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
      void dialog.dismiss();
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
    const renderedTextChars = loaded
      ? Number(
          await page.evaluate(
            'document.body ? document.body.innerText.replace(/\\s+/g, "").length : 0',
          ),
        )
      : 0;

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
    await browser.close();
  }
}
