import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConversionResult } from "@fidelark/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { convertFile } from "./convert.ts";
import { InputError } from "./inspect.ts";
import { buildZip } from "./testing.ts";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "fidelark-convert-"));
  await mkdir(join(dir, "css"));
  await writeFile(
    join(dir, "index.html"),
    [
      "<!doctype html><html><head><title>t</title>",
      '<link rel="stylesheet" href="css/site.css">',
      '<script src="https://cdn.test/lib.js"></script>',
      "</head><body><p>Hello</p><script>lib()</script></body></html>",
    ].join("\n"),
  );
  await writeFile(join(dir, "css", "site.css"), "p { color: red }");
  await writeFile(join(dir, "notes.md"), "# Notes");
  // A secret next to the archive: a ZIP must never reach files outside itself.
  await writeFile(join(dir, "secret.txt"), "do not embed");
  await writeFile(
    join(dir, "export.zip"),
    buildZip([
      {
        name: "site/index.html",
        content: [
          '<!doctype html><html><head><link rel="stylesheet" href="/css/main.css"></head>',
          '<body><p>Zip</p><img src="../secret.txt"><img src="../../../../secret.txt">',
          '<img src="img/a%20b.svg"></body></html>',
        ].join("\n"),
      },
      { name: "site/css/main.css", content: "@import 'fonts.css'; p { color: blue }" },
      { name: "site/css/fonts.css", content: "@font-face { src: url(../f.woff2) }" },
      { name: "site/f.woff2", content: "woff2" },
      { name: "site/img/a b.svg", content: "<svg/>" },
    ]),
  );
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const fixedNow = () => new Date("2026-11-14T12:00:00.000Z");
const fakeRemote = async (url: URL) => ({
  bytes: Buffer.from("function lib(){}"),
  contentType: "text/javascript",
  finalUrl: url,
});

describe("convertFile", () => {
  it("embeds local files, leaves remote ones without network permission, and reports both", async () => {
    const { html, result } = await convertFile(join(dir, "index.html"), "out.html", {
      now: fixedNow,
    });
    expect(ConversionResult.safeParse(result).success).toBe(true);
    expect(html).toContain("<style>p { color: red }</style>");
    expect(html).toContain('src="https://cdn.test/lib.js"');
    expect(result.findings.map((f) => f.code)).toEqual([
      "export.bundled",
      "export.network-not-allowed",
    ]);
    // Before: the local stylesheet is not part of the single file (semantic equivalent).
    expect(result.before.analysis?.fidelity.overall).toBe("semantic-equivalent");
    // After: the stylesheet is embedded; only the remote script remains (bundled portable).
    expect(result.after.analysis?.fidelity.overall).toBe("bundled-portable");
    expect(result.after.input.name).toBe("out.html");
  });

  it("embeds remote files when network access is allowed, improving fidelity", async () => {
    const { html, result } = await convertFile(join(dir, "index.html"), "out.html", {
      allowNetwork: true,
      fetchRemote: fakeRemote,
      now: fixedNow,
    });
    expect(html).toContain("<script>function lib(){}</script>");
    expect(result.manifest.bundled.map((b) => [b.kind, b.from])).toEqual([
      ["stylesheet", "local"],
      ["script", "remote"],
    ]);
    expect(result.after.analysis?.fidelity.overall).toBe("exact-portable");
    expect(result.after.analysis?.permissions.network).toBe(false);
  });

  it("rejects input that is not HTML", async () => {
    await expect(convertFile(join(dir, "notes.md"), "out.html")).rejects.toBeInstanceOf(InputError);
  });
});

describe("convertFile with a ZIP export", () => {
  it("embeds files from the archive only, resolving root-relative and escaped paths", async () => {
    const { html, result } = await convertFile(join(dir, "export.zip"), "out.html", {
      now: fixedNow,
    });
    expect(result.manifest.source.name).toBe("export.zip");
    expect(result.manifest.source.sha256).toBe(result.before.input.sha256);
    expect(result.manifest.bundled.map((b) => `${b.kind} ${b.specifier}`)).toEqual([
      "stylesheet /css/main.css",
      "stylesheet fonts.css",
      "font ../f.woff2",
      "image img/a%20b.svg",
    ]);
    expect(result.manifest.skipped.map((s) => `${s.specifier}: ${s.reason}`)).toEqual([
      // site/../secret.txt is the archive root, where there is no such file.
      "../secret.txt: file not found in the archive",
      "../../../../secret.txt: outside the archive",
    ]);
    expect(html).not.toContain("do not embed");
    expect(html).toContain("p { color: blue }");
  });
});
