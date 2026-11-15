import { Analysis, Finding } from "@fidelark/schema";
import { describe, expect, it } from "vitest";
import { analyzeHtml } from "./analyze.ts";
import { assessFidelity, type FidelitySignals } from "./fidelity.ts";
import type { LocalFiles } from "./local.ts";

const doc = (head: string, body: string) =>
  `<!doctype html>\n<html>\n<head>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>`;
const codes = (html: string) => analyzeHtml(html).findings.map((f) => f.code);

describe("analyzeHtml", () => {
  it("returns schema-valid analysis and findings", () => {
    const { analysis, findings } = analyzeHtml(
      doc('<script src="https://x.test/a.js"></script>', "<p>Hi</p>"),
    );
    expect(Analysis.safeParse(analysis).success).toBe(true);
    for (const f of findings) expect(Finding.safeParse(f).success).toBe(true);
  });

  it("collects references from links, media, srcset, CSS and SVG with line numbers", () => {
    const html = doc(
      [
        '<link rel="icon" href="/favicon.ico">',
        '<link rel="preload" as="font" href="https://f.test/a.woff2">',
        "<style>body { background: url(bg.png) }</style>",
      ].join("\n"),
      [
        '<img src="a.png" srcset="a@2x.png 2x">',
        '<picture><source srcset="b.webp"></picture>',
        '<video src="https://v.test/c.mp4" poster="poster.jpg"></video>',
        '<svg><image href="d.png"/><use href="#local"/></svg>',
        "<div style=\"background-image: url('e.png')\"></div>",
      ].join("\n"),
    );
    const deps = analyzeHtml(html).analysis.dependencies.map(
      (d) => `${d.kind} ${d.location} ${d.specifier} @${d.evidence[0]}`,
    );
    expect(deps).toEqual([
      'image relative /favicon.ico @<link rel="icon"> line 4',
      'font remote https://f.test/a.woff2 @<link rel="preload"> line 5',
      "image relative bg.png @<style> line 6",
      "image relative a.png @<img src> line 9",
      "image relative a@2x.png @<img srcset> line 9",
      "image relative b.webp @<source srcset> line 10",
      "media remote https://v.test/c.mp4 @<video src> line 11",
      "image relative poster.jpg @<video poster> line 11",
      "image relative d.png @<svg image> line 12",
      "image relative e.png @style attribute line 13",
    ]);
  });

  it("merges repeated references and keeps every location", () => {
    const html = doc("", '<img src="x.png">\n<img src="x.png">');
    const [dep] = analyzeHtml(html).analysis.dependencies;
    expect(dep?.evidence).toEqual(["<img src> line 7", "<img src> line 8"]);
  });

  it("shortens embedded data URIs and marks them bundled", () => {
    const uri = `data:image/png;base64,${"A".repeat(500)}`;
    const [dep] = analyzeHtml(doc("", `<img src="${uri}">`)).analysis.dependencies;
    expect(dep).toMatchObject({ location: "embedded", bundled: true });
    expect(dep?.specifier.length).toBeLessThanOrEqual(120);
  });

  it("resolves bare imports through an import map", () => {
    const html = doc(
      '<script type="importmap">{"imports": {"react": "https://esm.sh/react@18", "lib/": "https://esm.sh/lib/"}}</script>',
      '<script type="module">import React from "react"; import x from "lib/x.js"; import y from "missing";</script>',
    );
    const { analysis, findings } = analyzeHtml(html);
    expect(analysis.dependencies.map((d) => `${d.location} ${d.specifier}`)).toEqual([
      "remote https://esm.sh/react@18",
      "remote https://esm.sh/lib/",
      "bare missing",
    ]);
    expect(findings.map((f) => f.code)).toContain("dependency.bare-import");
  });

  it("ignores data blocks and template content", () => {
    const html = doc(
      '<script type="application/json">{"url": "https://x.test"}</script>',
      '<template><img src="t.png"><script>fetch("https://y.test")</script></template>',
    );
    const { analysis } = analyzeHtml(html);
    expect(analysis.dependencies).toEqual([]);
    expect(analysis.permissions).toEqual({ scripts: false, network: false, storage: false });
  });

  it("analyzes event handlers and javascript: URLs as code", () => {
    const html = doc(
      "",
      '<button onclick="fetch(\'https://x.test/ping\')">Go</button>\n<a href="javascript:void(0)">x</a>',
    );
    const { analysis, findings } = analyzeHtml(html);
    expect(analysis.capabilities).toEqual(["html", "inline-script", "network-fetch"]);
    expect(analysis.fidelity.axes.behavioral.class).toBe("connected");
    expect(findings.find((f) => f.code === "script.inline")?.message).toBe(
      "Contains 1 event handler attribute, 1 javascript: URL. Nothing is executed during inspection.",
    );
  });

  it("redacts credentials in specifiers and reports them", () => {
    const html = doc(
      '<script src="https://maps.example.com/api/js?key=abcdefgh12345678"></script>',
      "",
    );
    const { analysis, findings } = analyzeHtml(html);
    expect(analysis.dependencies[0]?.specifier).toBe(
      "https://maps.example.com/api/js?key=[redacted]",
    );
    expect(JSON.stringify({ analysis, findings })).not.toContain("abcdefgh12345678");
    expect(findings.map((f) => f.code)).toContain("secret.possible");
  });

  it("reports base href, meta refresh, dynamic code and script injection", () => {
    const html = doc(
      '<base href="https://cdn.example.com/">\n<meta http-equiv="refresh" content="0; url=https://x.test">',
      '<script>eval(x); document.createElement("script"); import(y);</script>',
    );
    expect(codes(html)).toEqual(
      expect.arrayContaining([
        "html.base",
        "html.meta-refresh",
        "script.dynamic-code",
        "script.injection",
        "script.dynamic-import",
      ]),
    );
  });

  it("does not count text in scripts, styles or the head as content", () => {
    const html = doc("<title>Title text</title><style>p{}</style>", "<script>var a = 1;</script>");
    const { content } = analyzeHtml(html).analysis.fidelity.axes;
    expect(content.evidence[0]).toBe(
      "Content is rendered by scripts, so it follows behavioral fidelity.",
    );
  });

  it("always states that fidelity is not yet verified", () => {
    expect(codes(doc("", "<p>x</p>")).at(-1)).toBe("fidelity.unverified");
  });
});

describe("assessFidelity", () => {
  const base: FidelitySignals = {
    staticTextChars: 10,
    scriptsPresent: false,
    dependencies: [],
    runtimeNetwork: [],
    computedCode: [],
    remoteForms: [],
    hostApi: [],
  };
  const dep = (kind: string, location: string) =>
    ({
      kind,
      location,
      specifier: `${kind}.${location}`,
      bundled: location === "embedded",
      evidence: [],
    }) as never;

  it("is exact-portable for a static document", () => {
    const f = assessFidelity(base);
    expect([f.overall, f.axes.content.class, f.axes.visual.class, f.axes.behavioral.class]).toEqual(
      ["exact-portable", "exact-portable", "exact-portable", "exact-portable"],
    );
  });

  it.each([
    [
      "remote stylesheet",
      { dependencies: [dep("stylesheet", "remote")] },
      "visual",
      "bundled-portable",
    ],
    [
      "missing image",
      { dependencies: [dep("image", "relative")] },
      "visual",
      "semantic-equivalent",
    ],
    ["remote frame", { dependencies: [dep("frame", "remote")] }, "visual", "connected"],
    ["embedded image", { dependencies: [dep("image", "embedded")] }, "visual", "exact-portable"],
    [
      "remote script",
      { scriptsPresent: true, dependencies: [dep("script", "remote")] },
      "behavioral",
      "bundled-portable",
    ],
    ["runtime fetch", { scriptsPresent: true, runtimeNetwork: ["x"] }, "behavioral", "connected"],
    ["remote form", { remoteForms: ["x"] }, "behavioral", "connected"],
    [
      "missing script",
      { scriptsPresent: true, dependencies: [dep("script", "relative")] },
      "behavioral",
      "static-fallback",
    ],
    [
      "bare module",
      { scriptsPresent: true, dependencies: [dep("module", "bare")] },
      "behavioral",
      "static-fallback",
    ],
    ["host API", { scriptsPresent: true, hostApi: ["window.claude"] }, "behavioral", "unsupported"],
  ] as const)("%s → %s %s", (_name, signals, axisName, expected) => {
    const f = assessFidelity({ ...base, ...signals });
    expect(f.axes[axisName].class).toBe(expected);
    expect(f.overall).toBe(expected);
  });

  it("leads behavioral evidence with the reason for the worst class", () => {
    const f = assessFidelity({
      ...base,
      scriptsPresent: true,
      runtimeNetwork: ["https://api.test (fetch() line 3)"],
      dependencies: [dep("script", "remote")],
    });
    expect(f.axes.behavioral.evidence[0]).toMatch(/^Makes 1 network request at runtime/);
  });

  it("lets script-rendered content follow behavioral fidelity", () => {
    const f = assessFidelity({
      ...base,
      staticTextChars: 0,
      scriptsPresent: true,
      runtimeNetwork: ["x"],
    });
    expect(f.axes.content.class).toBe("connected");
  });
});

describe("analyzeHtml on hostile input", () => {
  it("walks deeply nested documents without overflowing the stack", () => {
    const html = `<!doctype html>${"<div>".repeat(100_000)}deep${"<svg><g>".repeat(20_000)}`;
    const { analysis } = analyzeHtml(html);
    expect(analysis.fidelity.axes.content.evidence[0]).toBe(
      "4 characters of static text are in the document.",
    );
    expect(analysis.capabilities).toContain("svg");
  });
});

/** The other files of a ZIP export, with the document at site/index.html. */
function archive(files: Record<string, string>): LocalFiles {
  const encoded = new Map(Object.entries(files).map(([p, c]) => [p, new TextEncoder().encode(c)]));
  return { documentPath: "site/index.html", rootPath: "site", read: (p) => encoded.get(p) };
}

describe("analyzeHtml with archive files", () => {
  it("treats a module script src as a URL, not a bare module name", () => {
    const deps = analyzeHtml(doc('<script type="module" src="app.js"></script>', "")).analysis
      .dependencies;
    expect(deps.map((d) => `${d.kind} ${d.location} ${d.specifier}`)).toEqual([
      "module relative app.js",
    ]);
  });

  it("counts files in the archive as shipped and follows styles and scripts into them", () => {
    const html = doc(
      '<link rel="stylesheet" href="css/main.css">\n<script src="app.js"></script>',
      '<img src="/img/logo.svg" alt="">\n<img src="missing.png" alt="">',
    );
    const local = archive({
      "site/css/main.css":
        "@font-face { src: url(../fonts/inter.woff2) }\nbody { background: url('../img/bg.png?v=2') }",
      "site/fonts/inter.woff2": "font",
      "site/img/bg.png": "png",
      "site/img/logo.svg": "<svg/>",
      "site/app.js": 'localStorage.setItem("x", 1);\nfetch("https://api.test/data");',
    });
    const { analysis, findings } = analyzeHtml(html, local);
    expect(
      analysis.dependencies.map((d) => `${d.kind} ${d.specifier} ${d.bundled} @${d.evidence[0]}`),
    ).toEqual([
      'stylesheet css/main.css true @<link rel="stylesheet"> line 4',
      "script app.js true @<script src> line 5",
      "image /img/logo.svg true @<img src> line 8",
      "image missing.png false @<img src> line 9",
      "font ../fonts/inter.woff2 true @site/css/main.css line 1",
      "image ../img/bg.png?v=2 true @site/css/main.css line 2",
      "network https://api.test/data false @fetch() in site/app.js line 2",
    ]);
    expect(analysis.capabilities).toEqual(
      expect.arrayContaining(["css", "web-font", "image", "network-fetch", "storage"]),
    );
    const missing = findings.find((f) => f.code === "dependency.missing");
    expect(missing?.message).toBe("1 local file referenced but not found in the archive.");
    expect(analysis.fidelity.axes.visual.evidence[0]).toBe(
      "1 local style or media file is not in the archive: missing.png.",
    );
    expect(analysis.fidelity.overall).toBe("connected");
  });

  it("follows module graphs and says browsers will not run them from disk", () => {
    const local = archive({
      "site/main.js": 'import { add } from "./lib/math.js";\nimport("./lazy.js");',
      "site/lib/math.js": 'export const add = (a, b) => a + b;\nimport "../main.js";',
      "site/lazy.js": "export default 1;",
    });
    const { analysis, findings } = analyzeHtml(
      doc('<script type="module" src="main.js"></script>', "<p>Sum</p>"),
      local,
    );
    // ../main.js from lib/math.js is site/main.js again: one file, two references.
    expect(
      analysis.dependencies.map((d) => `${d.specifier} ${d.bundled} ${d.evidence.length}`),
    ).toEqual(["main.js true 2", "./lib/math.js true 1", "./lazy.js true 1"]);
    const modules = findings.find((f) => f.code === "script.module-files");
    expect(modules?.evidence).toEqual(["site/main.js", "site/lib/math.js", "site/lazy.js"]);
    expect(analysis.fidelity.overall).toBe("bundled-portable");
  });

  it("scans archive code for credentials and never resolves outside the archive", () => {
    const local = archive({ "site/app.js": 'const key = "AKIAABCDEFGHIJKLMNOP";' });
    const { analysis, findings } = analyzeHtml(
      doc('<script src="app.js"></script><script src="../../etc/passwd"></script>', ""),
      local,
    );
    expect(findings.find((f) => f.code === "secret.possible")?.evidence).toEqual([
      "AWS access key ID site/app.js line 1: AKIA… (20 chars)",
    ]);
    expect(analysis.dependencies.map((d) => `${d.specifier} ${d.bundled}`)).toEqual([
      "app.js true",
      "../../etc/passwd false",
    ]);
  });
});
