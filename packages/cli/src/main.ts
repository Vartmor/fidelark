import { parseArgs } from "node:util";
import { InputError, inspectFile, VERSION } from "@fidelark/core";
import { formatReport } from "./format.ts";

export type Io = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
};

/** Exit codes: 0 = ok, 1 = report contains errors, 2 = usage or input error. */
export const EXIT = { ok: 0, findings: 1, usage: 2 } as const;

const HELP = `fidelark ${VERSION} — keep AI work usable beyond the chat

Usage:
  fidelark inspect <file> [--json]

Commands:
  inspect   Classify a file and print its portability report. Never executes the input.

Options:
  --json         Print the report as JSON (stable, schema-versioned output)
  -h, --help     Show this help
  -v, --version  Show the version

Planned: convert, verify.
`;

export async function main(argv: readonly string[], io: Io): Promise<number> {
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

  switch (command) {
    case "inspect":
      return inspect(args, values.json ?? false, io);
    default:
      io.stderr(`error: unknown command "${command}"\n\n${HELP}`);
      return EXIT.usage;
  }
}

function parse(argv: readonly string[]) {
  return parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
}

async function inspect(args: string[], json: boolean, io: Io): Promise<number> {
  if (args.length !== 1) {
    io.stderr("error: inspect takes exactly one file\n");
    return EXIT.usage;
  }
  const [path] = args as [string];
  try {
    const report = await inspectFile(path);
    io.stdout(json ? `${JSON.stringify(report, null, 2)}\n` : formatReport(report));
    return report.findings.some((f) => f.severity === "error") ? EXIT.findings : EXIT.ok;
  } catch (error) {
    if (error instanceof InputError) {
      io.stderr(`error: ${error.message}\n`);
      return EXIT.usage;
    }
    throw error;
  }
}
