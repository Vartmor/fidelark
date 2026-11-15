import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { main } from "../packages/cli/src/main.ts";

const FIXTURE = fileURLToPath(
  new URL("../fixtures/adversarial/leaked-credentials/artifact.html", import.meta.url),
);
// The fake credentials in that fixture. Reports are meant to be shared, so none may appear.
const SECRETS = [
  "demo-key-not-real-0000",
  "demoTokenNotReal0123456789abcdef",
  "demo-not-a-real-key-1111",
];

async function output(...argv: string[]) {
  let text = "";
  const write = (t: string) => {
    text += t;
  };
  await main(argv, { stdout: write, stderr: write });
  return text;
}

describe("credential redaction", () => {
  it("never prints a detected credential in inspect, convert or verify output", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fidelark-redaction-"));
    try {
      const outputs = [
        await output("inspect", FIXTURE),
        await output("inspect", FIXTURE, "--json"),
        await output("convert", FIXTURE, "-o", join(dir, "out.html"), "--json"),
        await output("verify", FIXTURE, "--static-only", "--json"),
      ];
      for (const text of outputs) {
        expect(text).toContain("[redacted]");
        for (const secret of SECRETS) expect(text).not.toContain(secret);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
