import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InputError } from "@fidelark/core";
import { type BrowserCheck, VerificationResult } from "@fidelark/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findBrowser } from "./browser.ts";
import { BROWSER_TEST_TIMEOUT } from "./testing.ts";
import { decide, type VerifyOptions, verifyFile } from "./verify.ts";

const browserPath = await findBrowser();

let dir: string;
const file = (name: string) => join(dir, name);
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "fidelark-verify-"));
  await writeFile(
    file("ok.html"),
    "<!doctype html><title>t</title><p id=p></p><script>p.textContent = 'offline ok'</script>",
  );
  await writeFile(
    file("connected.html"),
    '<!doctype html><p>x</p><script>fetch("https://api.test/data").catch(() => {})</script>',
  );
  await writeFile(
    file("blank.html"),
    "<!doctype html><div id=root></div><script>missingLibrary.init()</script>",
  );
  await writeFile(
    file("degraded.html"),
    "<!doctype html><p>Still readable</p><script>missingLibrary.init()</script>",
  );
  await writeFile(
    file("external.html"),
    '<!doctype html><p>x</p><img src="https://img.test/a.png">',
  );
  await writeFile(file("notes.md"), "# Notes");
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const check = (overrides: Partial<BrowserCheck> = {}): BrowserCheck => ({
  browser: "Chromium test",
  sandboxed: true,
  loaded: true,
  renderedTextChars: 10,
  blockedRequests: [],
  pageErrors: [],
  consoleErrors: [],
  ...overrides,
});

describe("decide", () => {
  it("maps browser results and self-containment to a verdict", () => {
    expect(decide(null, [])).toBe("not-run");
    expect(decide(check(), [])).toBe("passed");
    expect(decide(check({ blockedRequests: ["https://x.test"] }), [])).toBe("partial");
    expect(decide(check({ consoleErrors: ["x"] }), [])).toBe("partial");
    expect(
      decide(check(), [
        { kind: "image", specifier: "a.png", location: "relative", bundled: false, evidence: [] },
      ]),
    ).toBe("partial");
    expect(decide(check({ pageErrors: ["boom"] }), [])).toBe("partial");
    expect(decide(check({ pageErrors: ["boom"], renderedTextChars: 0 }), [])).toBe("failed");
    expect(decide(check({ blockedRequests: ["x"], renderedTextChars: 0 }), [])).toBe("failed");
    expect(decide(check({ renderedTextChars: 0 }), [])).toBe("passed");
    expect(decide(check({ loaded: false }), [])).toBe("failed");
  });

  it("never passes what static analysis already rated as needing a connection or platform", () => {
    expect(decide(check(), [], "exact-portable")).toBe("passed");
    expect(decide(check(), [], "bundled-portable")).toBe("passed");
    expect(decide(check(), [], "connected")).toBe("partial");
    expect(decide(check(), [], "unsupported")).toBe("partial");
  });
});

describe("verifyFile (static)", () => {
  it("reports external files without opening a browser", async () => {
    const result = await verifyFile(file("external.html"), { staticOnly: true });
    expect(VerificationResult.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({ selfContained: false, browser: null, verdict: "not-run" });
    expect(result.findings.map((f) => f.code)).toEqual([
      "verify.skipped",
      "verify.not-self-contained",
    ]);
  });

  it("reports a missing browser", async () => {
    const previous = process.env.FIDELARK_BROWSER;
    process.env.FIDELARK_BROWSER = file("no-such-browser");
    try {
      const result = await verifyFile(file("ok.html"));
      expect(result.verdict).toBe("not-run");
      expect(result.findings.map((f) => f.code)).toContain("verify.no-browser");
    } finally {
      if (previous === undefined) delete process.env.FIDELARK_BROWSER;
      else process.env.FIDELARK_BROWSER = previous;
    }
  });

  it("rejects input that is not HTML", async () => {
    await expect(verifyFile(file("notes.md"), { staticOnly: true })).rejects.toBeInstanceOf(
      InputError,
    );
  });
});

describe.skipIf(browserPath === null)(
  "verifyFile (offline browser)",
  { timeout: BROWSER_TEST_TIMEOUT },
  () => {
    // These tests open only files they wrote, in the sandboxed browser.
    const options: VerifyOptions = { settleMs: 300, timeoutMs: 30_000 };

    it("passes a self-contained page that works offline", async () => {
      const result = await verifyFile(file("ok.html"), options);
      expect(result.verdict).toBe("passed");
      expect(result.browser).toMatchObject({ loaded: true, blockedRequests: [], pageErrors: [] });
      expect(result.browser?.renderedTextChars).toBeGreaterThan(0);
    });

    it("blocks and reports network requests", async () => {
      const result = await verifyFile(file("connected.html"), options);
      expect(result.verdict).toBe("partial");
      expect(result.browser?.blockedRequests).toEqual(["https://api.test/data"]);
    });

    it("fails a page that stays blank while raising errors", async () => {
      const result = await verifyFile(file("blank.html"), options);
      expect(result.verdict).toBe("failed");
      expect(result.browser?.pageErrors[0]).toMatch(/missingLibrary/);
    });

    it("rates a readable page with errors as partial", async () => {
      const result = await verifyFile(file("degraded.html"), options);
      expect(result.verdict).toBe("partial");
      expect(result.findings.find((f) => f.code === "verify.page-errors")?.severity).toBe(
        "warning",
      );
    });
  },
);
