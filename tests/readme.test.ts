import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { inspectFile } from "@fidelark/core";
import { describe, expect, it } from "vitest";
import { formatReport } from "../packages/cli/src/format.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const EXAMPLE = "fixtures/synthetic/live-data-widget/artifact.html";
const READMES = ["README.md", "README.tr.md"];

/** GitHub-style heading anchor: lowercase, punctuation removed, spaces to hyphens. */
const slug = (heading: string) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");

describe.each(READMES)("%s", (file) => {
  it("shows the current CLI output in its example report", async () => {
    const readme = await readFile(`${ROOT}${file}`, "utf8");
    const actual = formatReport(await inspectFile(`${ROOT}${EXAMPLE}`));
    expect(readme, "run the example and paste the new output").toContain(
      `$ pnpm fidelark inspect ${EXAMPLE}\n${actual}\`\`\``,
    );
  });

  it("has a table of contents whose links match its headings", async () => {
    const readme = await readFile(`${ROOT}${file}`, "utf8");
    const anchors = new Set([...readme.matchAll(/^## (.+)$/gm)].map((m) => slug(m[1] ?? "")));
    const links = [...readme.matchAll(/^- \[[^\]]+\]\(#([^)]+)\)$/gm)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) expect(anchors, `#${link}`).toContain(link);
  });

  it("links to the other language and states that the project is in development", async () => {
    const readme = await readFile(`${ROOT}${file}`, "utf8");
    const other = READMES.find((r) => r !== file);
    expect(readme).toContain(`href="${other}"`);
    expect(readme).toMatch(/\[!IMPORTANT\]\n> \*\*Fidelark/);
  });
});
