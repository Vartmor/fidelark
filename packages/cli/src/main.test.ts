import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERSION } from "@fidelark/core";
import { ConversionResult, PortabilityReport, VerificationResult } from "@fidelark/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatBytes } from "./format.ts";
import { type Deps, EXIT, main } from "./main.ts";

async function runWith(deps: Deps, argv: string[]) {
  let stdout = "";
  let stderr = "";
  const code = await main(
    argv,
    {
      stdout: (t) => {
        stdout += t;
      },
      stderr: (t) => {
        stderr += t;
      },
    },
    deps,
  );
  return { code, stdout, stderr };
}
const run = (...argv: string[]) => runWith({}, argv);

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "fidelark-cli-"));
  await writeFile(join(dir, "quiz.html"), "<!doctype html><html><body>Quiz</body></html>");
  await writeFile(join(dir, "data.csv"), "a,b\n1,2\n");
  await writeFile(join(dir, "notes.md"), "# Notes\n");
  await writeFile(join(dir, "app.js"), "document.title = 'ok';");
  await writeFile(
    join(dir, "page.html"),
    '<!doctype html><html><head><script src="app.js"></script><script src="https://cdn.test/x.js"></script></head><body><p>Page</p></body></html>',
  );
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("fidelark CLI", () => {
  it("prints help without arguments", async () => {
    const r = await run();
    expect(r.code).toBe(EXIT.ok);
    expect(r.stdout).toContain("fidelark inspect <file>");
  });

  it("prints the version", async () => {
    expect((await run("--version")).stdout).toBe(`${VERSION}\n`);
  });

  it("prints a human-readable report with an assessed fidelity", async () => {
    const r = await run("inspect", join(dir, "quiz.html"));
    expect(r.code).toBe(EXIT.ok);
    expect(r.stdout).toContain("quiz.html");
    expect(r.stdout).toContain(
      "Fidelity  ● Exact portable  (static analysis, not yet verified offline)",
    );
    expect(r.stdout).toContain("fidelity.unverified");
  });

  it("says fidelity is not assessed for formats without an analyzer", async () => {
    const r = await run("inspect", join(dir, "notes.md"));
    expect(r.code).toBe(EXIT.ok);
    expect(r.stdout).toContain("Fidelity  not assessed");
  });

  it("prints a schema-valid JSON report", async () => {
    const r = await run("inspect", join(dir, "quiz.html"), "--json");
    expect(r.code).toBe(EXIT.ok);
    expect(PortabilityReport.safeParse(JSON.parse(r.stdout)).success).toBe(true);
  });

  it("exits 1 when the report contains errors", async () => {
    const r = await run("inspect", join(dir, "data.csv"));
    expect(r.code).toBe(EXIT.findings);
    expect(r.stdout).toContain("input.unsupported-format");
  });

  it("exits 2 on usage and input errors", async () => {
    expect((await run("convert", join(dir, "missing.html"))).code).toBe(EXIT.usage);
    expect((await run("frobnicate", "x.html")).code).toBe(EXIT.usage);
    expect((await run("inspect")).code).toBe(EXIT.usage);
    expect((await run("inspect", "--bogus", "x.html")).code).toBe(EXIT.usage);
    const missing = await run("inspect", join(dir, "missing.html"));
    expect(missing.code).toBe(EXIT.usage);
    expect(missing.stderr).toContain("File not found");
  });
});

describe("fidelark convert", () => {
  const remote = {
    convert: {
      fetchRemote: async (url: URL) => ({
        bytes: Buffer.from("x()"),
        contentType: "text/javascript",
        finalUrl: url,
      }),
    },
  };

  it("writes <name>.fidelark.html next to the input and embeds local files", async () => {
    const r = await run("convert", join(dir, "page.html"));
    expect(r.code).toBe(EXIT.ok);
    const out = await readFile(join(dir, "page.fidelark.html"), "utf8");
    expect(out).toContain("<script>document.title = 'ok';</script>");
    expect(out).toContain('src="https://cdn.test/x.js"');
    expect(r.stdout).toContain("Embedded  1 resource");
    expect(r.stdout).toContain("export.network-not-allowed");
    expect(r.stdout).toContain(`Next: fidelark verify ${join(dir, "page.fidelark.html")}`);
  });

  it("refuses to overwrite without --force and never overwrites the input", async () => {
    const out = join(dir, "forced.html");
    expect((await runWith(remote, ["convert", join(dir, "page.html"), "-o", out])).code).toBe(
      EXIT.ok,
    );
    const again = await runWith(remote, ["convert", join(dir, "page.html"), "-o", out]);
    expect(again.code).toBe(EXIT.usage);
    expect(again.stderr).toContain("already exists");
    expect(
      (await runWith(remote, ["convert", join(dir, "page.html"), "-o", out, "--force"])).code,
    ).toBe(EXIT.ok);
    const self = await run("convert", join(dir, "page.html"), "-o", join(dir, "page.html"));
    expect(self.code).toBe(EXIT.usage);
    expect(self.stderr).toContain("must not overwrite the input");
  });

  it("downloads only with --allow-network and prints schema-valid JSON", async () => {
    const out = join(dir, "networked.html");
    const r = await runWith(remote, [
      "convert",
      join(dir, "page.html"),
      "-o",
      out,
      "--allow-network",
      "--json",
    ]);
    expect(r.code).toBe(EXIT.ok);
    const result = ConversionResult.parse(JSON.parse(r.stdout));
    expect(result.manifest.bundled.map((b) => b.from)).toEqual(["local", "remote"]);
    expect(result.after.analysis?.fidelity.overall).toBe("exact-portable");
  });

  it("rejects options that belong to another command and non-HTML input", async () => {
    const wrong = await run("convert", join(dir, "page.html"), "--static-only");
    expect(wrong.code).toBe(EXIT.usage);
    expect(wrong.stderr).toContain("--static-only is not an option of convert");
    const md = await run("convert", join(dir, "notes.md"));
    expect(md.code).toBe(EXIT.usage);
    expect(md.stderr).toContain("HTML input only");
    await expect(access(join(dir, "notes.fidelark.html"))).rejects.toThrow();
  });
});

describe("fidelark verify", () => {
  it("checks self-containment statically with --static-only", async () => {
    const r = await run("verify", join(dir, "quiz.html"), "--static-only");
    expect(r.code).toBe(EXIT.findings);
    expect(r.stdout).toContain("Verdict   not run");
    const json = await run("verify", join(dir, "quiz.html"), "--static-only", "--json");
    expect(VerificationResult.parse(JSON.parse(json.stdout))).toMatchObject({
      selfContained: true,
      verdict: "not-run",
    });
  });

  it("rejects non-HTML input", async () => {
    const r = await run("verify", join(dir, "notes.md"), "--static-only");
    expect(r.code).toBe(EXIT.usage);
  });
});

describe("formatBytes", () => {
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(25 * 1024 * 1024)).toBe("25.0 MB");
  });
});
