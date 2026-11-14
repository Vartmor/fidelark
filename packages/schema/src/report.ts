import { z } from "zod";
import { FidelityAssessment } from "./fidelity.ts";

/** Version of the report and fixture contracts. Bump on any breaking change (semver). */
export const SCHEMA_VERSION = "0.2.0";

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

/** What the artifact uses. A fixed vocabulary, so reports and fixtures can be compared. */
export const CAPABILITIES = [
  "html",
  "css",
  "inline-script",
  "external-script",
  "module-script",
  "web-font",
  "image",
  "media",
  "canvas",
  "svg",
  "form",
  "iframe",
  "network-fetch",
  "websocket",
  "storage",
  "dynamic-code",
  "worker",
  "host-api",
] as const;
export const Capability = z.enum(CAPABILITIES);
export type Capability = z.infer<typeof Capability>;

export const DependencyKind = z.enum([
  "script",
  "module",
  "stylesheet",
  "font",
  "image",
  "media",
  "frame",
  "network",
  "other",
]);
export type DependencyKind = z.infer<typeof DependencyKind>;

/**
 * Where a dependency lives: `remote` (http, https or protocol-relative URL), `relative`
 * (a path next to the artifact), `embedded` (data: URI) or `bare` (a module name such as
 * "react" that only resolves through an import map or bundler).
 */
export const DependencyLocation = z.enum(["remote", "relative", "embedded", "bare"]);
export type DependencyLocation = z.infer<typeof DependencyLocation>;

export const Dependency = z.strictObject({
  kind: DependencyKind,
  /** The reference as written in the artifact, with credentials redacted. */
  specifier: z.string().min(1),
  location: DependencyLocation,
  bundled: z.boolean(),
  sha256: Sha256.optional(),
  /** Where the reference was found, e.g. `<script src> line 6`. */
  evidence: z.array(z.string()),
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
  capabilities: z.array(Capability),
  dependencies: z.array(Dependency),
  permissions: Permissions,
  fidelity: FidelityAssessment,
  exportOptions: z.array(ExportTarget),
});
export type Analysis = z.infer<typeof Analysis>;

export const Tool = z.strictObject({ name: z.literal("fidelark"), version: z.string().min(1) });
export type Tool = z.infer<typeof Tool>;

export const PortabilityReport = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  tool: Tool,
  generatedAt: z.iso.datetime(),
  input: InputInfo,
  /** Null until the input has been analyzed; fidelity is never guessed. */
  analysis: Analysis.nullable(),
  findings: z.array(Finding),
});
export type PortabilityReport = z.infer<typeof PortabilityReport>;
