import { createHash } from "node:crypto";
import { ExportManifest } from "@fidelark/schema";
import { describe, expect, it } from "vitest";
import { LoadError } from "./errors.ts";
import { exportStandaloneHtml, MANIFEST_ID } from "./export.ts";
import type { Loader } from "./loader.ts";

const DOC = new URL("file:///site/index.html");
const enc = new TextEncoder();
const b64 = (s: string) => Buffer.from(s).toString("base64");

/** A loader backed by a map of URL → [media type, content]; anything else is a 404. */
function fakeLoader(files: Record<string, [string, string]>, calls: string[] = []): Loader {
  return async (url) => {
    calls.push(url.href);
    const entry = files[url.href];
    if (!entry) throw new LoadError("HTTP 404");
    const bytes = enc.encode(entry[1]);
    return {
      bytes,
      mediaType: entry[0],
      url,
      from: url.protocol === "file:" ? "local" : "remote",
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  };
}

async function run(
  html: string,
  files: Record<string, [string, string]>,
  maxTotalBytes = 1_000_000,
) {
  return exportStandaloneHtml(html, {
    sourceName: "index.html",
    documentUrl: DOC,
    loader: fakeLoader(files),
    maxTotalBytes,
    toolVersion: "0.0.0",
    now: () => new Date("2026-11-14T12:00:00.000Z"),
  });
}

const manifestOf = (html: string) => {
  const json = new RegExp(
    `<script type="application/json" id="${MANIFEST_ID}">(.*?)</script>`,
  ).exec(html)?.[1];
  return ExportManifest.parse(JSON.parse(json ?? "null"));
};

describe("exportStandaloneHtml", () => {
  it("inlines classic scripts and escapes closing tags", async () => {
    const { html, manifest } = await run('<head><script src="app.js" id="a"></script></head>', {
      "file:///site/app.js": ["text/javascript", 'console.log("</script><!--");'],
    });
    expect(html).toContain('<script id="a">console.log("<\\/script><\\!--");</script>');
    expect(manifest.bundled).toEqual([
      expect.objectContaining({
        kind: "script",
        specifier: "app.js",
        from: "local",
        mediaType: "text/javascript",
      }),
    ]);
  });

  it("keeps defer and async semantics by embedding as a data URI", async () => {
    const { html } = await run('<script defer src="app.js"></script>', {
      "file:///site/app.js": ["text/javascript", "go()"],
    });
    expect(html).toContain(
      `<script src="data:text/javascript;base64,${b64("go()")}" defer></script>`,
    );
  });

  it("checks Subresource Integrity before embedding", async () => {
    const code = "lib()";
    const good = `sha384-${createHash("sha384").update(code).digest("base64")}`;
    const files: Record<string, [string, string]> = {
      "https://cdn.test/lib.js": ["text/javascript", code],
    };
    const ok = await run(
      `<script src="https://cdn.test/lib.js" integrity="${good}" crossorigin="anonymous"></script>`,
      files,
    );
    expect(ok.html).toContain("<script>lib()</script>");

    const bad = await run(
      '<script src="https://cdn.test/lib.js" integrity="sha384-AAAA"></script>',
      files,
    );
    expect(bad.html).toContain('src="https://cdn.test/lib.js"');
    expect(bad.manifest.bundled).toEqual([]);
    expect(bad.manifest.skipped[0]).toMatchObject({
      failed: true,
      reason: expect.stringContaining("integrity"),
    });
    expect(bad.findings.map((f) => f.code)).toContain("export.failed");
  });

  it("turns stylesheets into style elements with imports, fonts and images embedded", async () => {
    const { html } = await run(
      '<link rel="stylesheet" media="screen" href="https://cdn.test/css/main.css">',
      {
        "https://cdn.test/css/main.css": [
          "text/css",
          '@import url("print.css") print;\n@font-face { src: url(../fonts/a.woff2) }\nh1 { background: url(img/bg.png) }',
        ],
        "https://cdn.test/css/print.css": ["text/css", '@charset "utf-8";\nbody { color: black }'],
        "https://cdn.test/fonts/a.woff2": ["font/woff2", "FONT"],
        "https://cdn.test/css/img/bg.png": ["image/png", "PNG"],
      },
    );
    expect(html).toContain('<style media="screen">@media print {\n\nbody { color: black }\n}');
    expect(html).toContain(`url("data:font/woff2;base64,${b64("FONT")}")`);
    expect(html).toContain(`url("data:image/png;base64,${b64("PNG")}")`);
    expect(html).not.toContain("@charset");
  });

  it("embeds images, srcset candidates, icons and style attributes", async () => {
    const files: Record<string, [string, string]> = {
      "file:///site/a.png": ["image/png", "A"],
      "file:///site/b.png": ["image/png", "B"],
      "file:///site/icon.svg": ["image/svg+xml", "<svg/>"],
    };
    const { html } = await run(
      '<link rel="icon" href="icon.svg"><img src="a.png" srcset="a.png 1x, b.png 2x"><div style="background:url(\'b.png\')"></div>',
      files,
    );
    expect(html).toContain(`href="data:image/svg+xml;base64,${b64("<svg/>")}"`);
    expect(html).toContain(`src="data:image/png;base64,${b64("A")}"`);
    expect(html).toContain(
      `srcset="data:image/png;base64,${b64("A")} 1x, data:image/png;base64,${b64("B")} 2x"`,
    );
    expect(html).toContain(`style="background:url(&quot;data:image/png;base64,${b64("B")}&quot;)"`);
  });

  it("resolves root-relative paths against the root and honors <base href>", async () => {
    const files: Record<string, [string, string]> = {
      "file:///site/lib.js": ["text/javascript", "lib"],
      "file:///site/assets/x.png": ["image/png", "X"],
    };
    const { manifest } = await run(
      '<base href="assets/"><script src="/lib.js"></script><img src="x.png">',
      files,
    );
    expect(manifest.bundled.map((b) => b.specifier)).toEqual(["/lib.js", "x.png"]);
  });

  it("removes resource hints and leaves frames, modules and manifests external", async () => {
    const { html, manifest, findings } = await run(
      [
        '<link rel="preconnect" href="https://fonts.test">',
        '<link rel="manifest" href="app.webmanifest">',
        '<script type="module" src="main.js"></script>',
        '<iframe src="https://video.test/embed"></iframe>',
      ].join(""),
      {},
    );
    expect(html).not.toContain("preconnect");
    expect(manifest.skipped.map((s) => [s.kind, s.failed])).toEqual([
      ["other", false],
      ["module", false],
      ["frame", false],
    ]);
    expect(findings.map((f) => f.code)).toEqual(["export.external", "export.hints-removed"]);
  });

  it("does not touch template content, fragments or data URIs", async () => {
    const calls: string[] = [];
    const source =
      '<template><img src="t.png"></template><img src="data:image/png;base64,AA=="><svg><use href="#i"/></svg>';
    const { html } = await exportStandaloneHtml(source, {
      sourceName: "index.html",
      documentUrl: DOC,
      loader: fakeLoader({}, calls),
      maxTotalBytes: 1000,
      toolVersion: "0.0.0",
    });
    expect(calls).toEqual([]);
    // Without an explicit <head>, the manifest goes first and the source follows untouched.
    expect(html.endsWith(source)).toBe(true);
  });

  it("keeps the original reference when a file is missing", async () => {
    const { html, manifest } = await run('<img src="missing.png">', {});
    expect(html).toContain('<img src="missing.png">');
    expect(manifest.skipped[0]).toMatchObject({
      specifier: "missing.png",
      reason: "HTTP 404",
      failed: true,
    });
  });

  it("enforces the total size budget", async () => {
    const files: Record<string, [string, string]> = {
      "file:///site/a.png": ["image/png", "x".repeat(60)],
      "file:///site/b.png": ["image/png", "y".repeat(60)],
    };
    const { manifest } = await run('<img src="a.png"><img src="b.png">', files, 100);
    expect(manifest.bundled).toHaveLength(1);
    expect(manifest.skipped[0]?.reason).toMatch(/total export size limit/);
  });

  it("embeds a schema-valid manifest before </head> and replaces it on re-export", async () => {
    const first = await run("<html><head><title>t</title></head><body>hi</body></html>", {});
    expect(first.html).toContain(`</title><script type="application/json" id="${MANIFEST_ID}">`);
    const manifest = manifestOf(first.html);
    expect(manifest.source).toEqual({
      name: "index.html",
      sha256: createHash("sha256")
        .update("<html><head><title>t</title></head><body>hi</body></html>")
        .digest("hex"),
    });
    const second = await run(first.html, {});
    expect(second.html.split(MANIFEST_ID)).toHaveLength(2);
  });

  it("leaves everything else byte for byte unchanged", async () => {
    const source =
      "<!doctype html>\n<html>\n  <head>\n    <title>  Spacing   kept </title>\n  </head>\n  <body>\n    <p class=x>Hello &amp; welcome</p>\n  </body>\n</html>\n";
    const { html } = await run(source, {});
    expect(
      html.replace(
        new RegExp(`<script type="application/json" id="${MANIFEST_ID}">.*?</script>`),
        "",
      ),
    ).toBe(source);
  });
});
