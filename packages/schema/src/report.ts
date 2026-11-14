import { z } from "zod";
import { FidelityAssessment } from "./fidelity.ts";

/** Version of the report and fixture contracts. Bump on any breaking change (semver). */
export const SCHEMA_VERSION = "0.1.0";

export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/, "lowercase hex SHA-256");

export const INPUT_FORMATS = ["html", "jsx", "tsx", "markdown", "zip", "unknown"] as const;
export const InputFormat = z.enum(INPUT_FORMATS);
export type InputFormat = z.infer<typeof InputFormat>;

export const Severity = z.enum(["info", "warning", "error"]);
export type Severity = z.infer<typeof Severity>;

/** A single observation about the input, always with a stable machine-readable code. */
export const Finding = z.strictObject({
  code: z.string().regex(/^[a-z]+(\.[a-z0-9-]+)+$/, "dotted lowercase code, e.g. input.too-large"),
  severity: Severity,
  message: z.string().min(1),
  evidence: z.array(z.string()).optional(),
});
export type Finding = z.infer<typeof Finding>;

export const InputInfo = z.strictObject({
  /** File name only; never an absolute path, so reports can be shared safely. */
  name: z.string().min(1),
  format: InputFormat,
  sizeBytes: z.int().nonnegative(),
  /** Null when the input was not read, e.g. because it exceeded the size limit. */
  sha256: Sha256.nullable(),
});
export type InputInfo = z.infer<typeof InputInfo>;

export const DependencyKind = z.enum([
  "script",
  "module",
  "stylesheet",
  "font",
  "image",
  "media",
  "fetch",
  "other",
]);

export const Dependency = z.strictObject({
  kind: DependencyKind,
  specifier: z.string().min(1),
  bundled: z.boolean(),
  sha256: Sha256.optional(),
});
export type Dependency = z.infer<typeof Dependency>;

/** Capabilities the artifact needs at runtime. All default-deny in the renderer. */
export const Permissions = z.strictObject({
  scripts: z.boolean(),
  network: z.boolean(),
  storage: z.boolean(),
});
export type Permissions = z.infer<typeof Permissions>;

export const ExportTarget = z.enum(["standalone-html", "zip", "markdown"]);
export type ExportTarget = z.infer<typeof ExportTarget>;

export const Analysis = z.strictObject({
  capabilities: z.array(z.string()),
  dependencies: z.array(Dependency),
  permissions: Permissions,
  fidelity: FidelityAssessment,
  exportOptions: z.array(ExportTarget),
});
export type Analysis = z.infer<typeof Analysis>;

export const PortabilityReport = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  tool: z.strictObject({ name: z.literal("fidelark"), version: z.string().min(1) }),
  generatedAt: z.iso.datetime(),
  input: InputInfo,
  /** Null until the input has been analyzed; fidelity is never guessed. */
  analysis: Analysis.nullable(),
  findings: z.array(Finding),
});
export type PortabilityReport = z.infer<typeof PortabilityReport>;
