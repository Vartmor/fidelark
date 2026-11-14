import { describe, expect, it } from "vitest";
import { extractCssReferences } from "./css.ts";
import { analyzeScript } from "./script.ts";
import { findSecrets, redactSecrets } from "./secrets.ts";
import { capList, lineLookup, truncate } from "./text.ts";
import { classifySpecifier, srcsetUrls } from "./urls.ts";

describe("classifySpecifier", () => {
  it.each([
    ["https://cdn.example.com/a.js", "remote"],
    ["//cdn.example.com/a.js", "remote"],
    ["wss://socket.example.com", "remote"],
    ["data:image/png;base64,AAAA", "embedded"],
    ["app.js", "relative"],
    ["./app.js", "relative"],
    ["/static/app.js", "relative"],
  ] as const)("%s → %s", (spec, location) => {
    expect(classifySpecifier(spec)).toBe(location);
  });

  it("treats module names as bare only in module context", () => {
    expect(classifySpecifier("react", { module: true })).toBe("bare");
    expect(classifySpecifier("preact/hooks", { module: true })).toBe("bare");
    expect(classifySpecifier("./util.js", { module: true })).toBe("relative");
    expect(classifySpecifier("react")).toBe("relative");
  });

  it.each(["", "#top", "about:blank", "javascript:void(0)", "mailto:a@example.com", "blob:x"])(
    "ignores %j",
    (spec) => {
      expect(classifySpecifier(spec)).toBeNull();
    },
  );
});

describe("srcsetUrls", () => {
  it("returns every candidate URL", () => {
    expect(srcsetUrls("a.png 1x, b.png 2x,c.png 3x")).toEqual(["a.png", "b.png", "c.png"]);
    expect(srcsetUrls("https://x.test/img.png?w=1,2 640w")).toEqual([
      "https://x.test/img.png?w=1,2",
    ]);
  });
});

describe("extractCssReferences", () => {
  it("separates imports, fonts and images and keeps line numbers", () => {
    const css = [
      '@import url("theme.css");',
      "/* url(ignored.png) */",
      "@font-face { font-family: X; src: url(https://fonts.example.com/x.woff2) format('woff2'); }",
      "body { background: url('bg.png'); }",
    ].join("\n");
    expect(extractCssReferences(css, 10)).toEqual([
      { url: "theme.css", kind: "stylesheet", line: 10 },
      { url: "https://fonts.example.com/x.woff2", kind: "font", line: 12 },
      { url: "bg.png", kind: "image", line: 13 },
    ]);
  });
});

describe("text helpers", () => {
  it("maps indexes to lines", () => {
    const lineOf = lineLookup("a\nbb\nccc", 5);
    expect([lineOf(0), lineOf(2), lineOf(3), lineOf(5), lineOf(8)]).toEqual([5, 6, 6, 7, 7]);
  });

  it("truncates and caps lists", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(capList(["a", "b", "c"], 2)).toEqual(["a", "b", "… and 1 more"]);
  });
});

describe("secrets", () => {
  // Test credentials are assembled at runtime so no real-looking secret is committed.
  const openai = ["sk", "proj", "A".repeat(24)].join("-");
  const github = `gh${"p"}_${"b".repeat(36)}`;
  const aws = `AK${"IA"}${"Q".repeat(16)}`;

  it("finds credentials and only reports redacted previews", () => {
    const text = `const key = "${openai}";\nfetch(url, { headers: { Authorization: "token ${github}" } });\n${aws}`;
    const hits = findSecrets(text);
    expect(hits.map((h) => [h.kind, h.line])).toEqual([
      ["OpenAI API key", 1],
      ["GitHub token", 2],
      ["AWS access key ID", 3],
    ]);
    for (const hit of hits) {
      expect(hit.preview).toMatch(/^.{4}… \(\d+ chars\)$/);
      expect(text).not.toContain(hit.preview.replace(/….*/, "").repeat(2));
    }
  });

  it("flags credentials in URL query parameters", () => {
    const hits = findSecrets("https://maps.example.com/js?callback=init&key=abcdefgh12345678");
    expect(hits.map((h) => h.kind)).toEqual(['credential in URL parameter "key"']);
  });

  it("redacts credentials inside strings", () => {
    expect(redactSecrets(`token=${openai}`)).not.toContain(openai);
    expect(redactSecrets("https://x.test/a?api_key=abcdefgh12345678&v=1")).toBe(
      "https://x.test/a?api_key=[redacted]&v=1",
    );
    expect(redactSecrets("https://x.test/a?page=2")).toBe("https://x.test/a?page=2");
  });

  it("does not flag ordinary text", () => {
    expect(findSecrets("const skip = 'sk-short'; // risk-free task")).toEqual([]);
  });
});

describe("analyzeScript", () => {
  it("finds network calls with their targets and lines", () => {
    const code = [
      'fetch("https://api.example.com/a");',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: JavaScript source under test.
      "window.fetch(`/data/${id}.json`);",
      'const xhr = new XMLHttpRequest(); xhr.open("GET", "https://api.example.com/b");',
      'navigator.sendBeacon("https://stats.example.com");',
      'new WebSocket("wss://live.example.com");',
      "fetch(buildUrl());",
    ].join("\n");
    const facts = analyzeScript(code, { startLine: 20 });
    expect(facts.parsed).toBe(true);
    expect(facts.network.map((r) => [r.via, r.target, r.line])).toEqual([
      ["fetch()", "https://api.example.com/a", 20],
      ["fetch()", "/data/….json", 21],
      ["XMLHttpRequest.open()", "https://api.example.com/b", 22],
      ["navigator.sendBeacon()", "https://stats.example.com", 23],
      ["fetch()", null, 25],
    ]);
    expect(facts.websockets.map((r) => r.target)).toEqual(["wss://live.example.com"]);
  });

  it("finds imports, storage, dynamic code, injection and host APIs", () => {
    const code = [
      'import { a } from "./a.js";',
      'export * from "lib";',
      'const m = await import("https://esm.sh/x");',
      "const n = await import(name);",
      'localStorage.setItem("k", 1); window.sessionStorage.clear(); document.cookie;',
      'eval("1"); new Function("return 1"); setTimeout("tick()", 10);',
      'document.createElement("script");',
      "await window.claude.complete(prompt);",
      'new Worker("worker.js");',
    ].join("\n");
    const facts = analyzeScript(code, { module: true });
    expect(facts.staticImports.map((r) => r.target)).toEqual(["./a.js", "lib"]);
    expect(facts.dynamicImports.map((r) => r.target)).toEqual(["https://esm.sh/x", null]);
    expect(facts.storage.map((r) => r.via)).toEqual([
      "localStorage",
      "sessionStorage",
      "document.cookie",
    ]);
    expect(facts.dynamicCode).toHaveLength(3);
    expect(facts.scriptInjection).toHaveLength(1);
    expect(facts.hostApi).toHaveLength(1);
    expect(facts.workers.map((r) => r.target)).toEqual(["worker.js"]);
  });

  it("does not report network use mentioned only in strings or comments", () => {
    const facts = analyzeScript('// fetch("https://x.test")\nconst s = "new WebSocket(url)";');
    expect(facts.network).toEqual([]);
    expect(facts.websockets).toEqual([]);
  });

  it("falls back to simpler rules for JSX", () => {
    const code =
      'const App = () => <button onClick={() => fetch("/api/save")}>Save</button>;\nlocalStorage.x = 1;';
    const facts = analyzeScript(code, { startLine: 3 });
    expect(facts.parsed).toBe(false);
    expect(facts.network.map((r) => [r.target, r.line])).toEqual([["/api/save", 3]]);
    expect(facts.storage.map((r) => r.line)).toEqual([4]);
  });
});
