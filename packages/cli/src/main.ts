import { realpath, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { type ConvertOptions, convertFile, InputError, inspectFile, VERSION } from "@fidelark/core";
import { type VerifyOptions, verifyFile } from "@fidelark/verifier";
import { formatConversion, formatReport, formatVerification } from "./format.ts";

export type Io = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
};

/** Test seams: options merged into what the CLI passes to convert and verify. */
export type Deps = {
  convert?: Partial<ConvertOptions>;
  verify?: Partial<VerifyOptions>;
};

/** Exit codes: 0 = ok, 1 = problems found (errors, failed or unverified), 2 = usage or input error. */
export const EXIT = { ok: 0, findings: 1, usage: 2 } as const;

const HELP = `fidelark ${VERSION} — keep AI work usable beyond the chat

Usage:
  fidelark inspect <file> [--json]
  fidelark convert <file.html> [-o <out.html>] [--allow-network] [--base <dir>] [--force] [--json]
  fidelark verify <file.html> [--static-only] [--no-sandbox] [--json]

Commands:
  inspect   Analyze a file and print its portability report (HTML today).
            Never executes, renders or fetches anything from the input.
  convert   Bundle an HTML file and its dependencies into one self-contained HTML file.
            Local files are read only from the input's directory (or --base). Remote files
            are downloaded only with --allow-network. The input is never executed.
  verify    Check that an HTML file works offline: open it in a sandboxed browser with all
            network access blocked and report blocked requests and errors. This runs the
            file's scripts inside the browser sandbox.

Options:
  -o, --output <file>  Output path for convert (default: <name>.fidelark.html)
  --allow-network      Let convert download remote dependencies (public addresses only)
  --base <dir>         Directory convert may read local dependencies from
  --force              Let convert overwrite an existing output file
  --static-only        Let verify skip the browser and only check self-containment
  --no-sandbox         Run the verify browser without its sandbox (trusted files only)
  --json               Print the result as JSON (stable, schema-versioned output)
  -h, --help           Show this help
  -v, --version        Show the version
`;

const COMMAND_OPTIONS: Record<string, Set<string>> = {
  inspect: new Set(["json"]),
  convert: new Set(["json", "output", "allow-network", "base", "force"]),
  verify: new Set(["json", "static-only", "no-sandbox"]),
};

export async function main(argv: readonly string[], io: Io, deps: Deps = {}): Promise<number> {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}\n\n${HELP}`);
    return EXIT.usage;
  }
  const { values, positionals } = parsed;

  if (values.version) {
    io.stdout(`${VERSION}\n`);
    return EXIT.ok;
  }
  const [command, ...args] = positionals;
  if (values.help || command === undefined || command === "help") {
    io.stdout(HELP);
    return EXIT.ok;
  }
  const allowed = COMMAND_OPTIONS[command];
  if (!allowed) {
    io.stderr(`error: unknown command "${command}"\n\n${HELP}`);
    return EXIT.usage;
  }
  const invalid = Object.keys(values).filter((name) => !allowed.has(name));
  if (invalid.length > 0) {
    io.stderr(`error: --${invalid[0]} is not an option of ${command}\n`);
    return EXIT.usage;
  }
  if (args.length !== 1) {
    io.stderr(`error: ${command} takes exactly one file\n`);
    return EXIT.usage;
  }
  const [path] = args as [string];

  try {
    switch (command) {
      case "inspect": {
        const report = await inspectFile(path);
        io.stdout(values.json ? json(report) : formatReport(report));
        return report.findings.some((f) => f.severity === "error") ? EXIT.findings : EXIT.ok;
      }
      case "convert":
        return await convert(path, values, io, deps);
      default: {
        const result = await verifyFile(path, {
          staticOnly: values["static-only"] === true,
          noSandbox: values["no-sandbox"] === true,
          ...deps.verify,
        });
        io.stdout(values.json ? json(result) : formatVerification(result));
        return result.verdict === "passed" ? EXIT.ok : EXIT.findings;
      }
    }
  } catch (error) {
    if (error instanceof InputError) {
      io.stderr(`error: ${error.message}\n`);
      return EXIT.usage;
    }
    throw error;
  }
}

function parse(argv: readonly string[]) {
  return parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      json: { type: "boolean" },
      output: { type: "string", short: "o" },
      "allow-network": { type: "boolean" },
      base: { type: "string" },
      force: { type: "boolean" },
      "static-only": { type: "boolean" },
      "no-sandbox": { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

function defaultOutput(path: string): string {
  const name = basename(path).replace(/\.html?$/i, "");
  return join(dirname(path), `${name}.fidelark.html`);
}

async function samePath(a: string, b: string): Promise<boolean> {
  const real = async (p: string) => realpath(p).catch(() => resolve(p));
  return (await real(a)) === (await real(b));
}

async function convert(
  path: string,
  values: ReturnType<typeof parse>["values"],
  io: Io,
  deps: Deps,
): Promise<number> {
  const output = values.output ?? defaultOutput(path);
  if (await samePath(path, output)) {
    io.stderr("error: the output must not overwrite the input\n");
    return EXIT.usage;
  }
  const { html, result } = await convertFile(path, basename(output), {
    allowNetwork: values["allow-network"] === true,
    ...(values.base ? { baseDir: values.base } : {}),
    ...deps.convert,
  });
  try {
    await writeFile(output, html, { flag: values.force ? "w" : "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      io.stderr(`error: ${output} already exists; use --force to overwrite it\n`);
      return EXIT.usage;
    }
    throw error;
  }
  io.stdout(values.json ? json(result) : formatConversion(result, output));
  return result.findings.some((f) => f.severity === "error") ? EXIT.findings : EXIT.ok;
}
