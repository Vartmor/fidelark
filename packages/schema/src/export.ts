import { z } from "zod";
import {
  Dependency,
  DependencyKind,
  Finding,
  InputInfo,
  PortabilityReport,
  SCHEMA_VERSION,
  Sha256,
  Tool,
} from "./report.ts";

/** A dependency that was embedded into the exported file. */
export const BundledResource = z.strictObject({
  kind: DependencyKind,
  /** The reference as written in the source, with credentials redacted. */
  specifier: z.string().min(1),
  from: z.enum(["local", "remote"]),
  mediaType: z.string().min(1),
  bytes: z.int().nonnegative(),
  sha256: Sha256,
});
export type BundledResource = z.infer<typeof BundledResource>;

/** A dependency left as an external reference, with the reason. */
export const SkippedResource = z.strictObject({
  kind: DependencyKind,
  specifier: z.string().min(1),
  reason: z.string().min(1),
  /** True when bundling was attempted and failed; false when it was not attempted by design. */
  failed: z.boolean(),
});
export type SkippedResource = z.infer<typeof SkippedResource>;

/** Provenance embedded in every exported file as `<script type="application/json" id="fidelark-export">`. */
export const ExportManifest = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  tool: Tool,
  exportedAt: z.iso.datetime(),
  source: z.strictObject({ name: z.string().min(1), sha256: Sha256 }),
  bundled: z.array(BundledResource),
  skipped: z.array(SkippedResource),
});
export type ExportManifest = z.infer<typeof ExportManifest>;

/** Output of `fidelark convert --json`: what was bundled and the reports before and after. */
export const ConversionResult = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  tool: Tool,
  generatedAt: z.iso.datetime(),
  manifest: ExportManifest,
  findings: z.array(Finding),
  before: PortabilityReport,
  after: PortabilityReport,
});
export type ConversionResult = z.infer<typeof ConversionResult>;

/** What happened when the file was opened in a sandboxed browser with all network access blocked. */
export const BrowserCheck = z.strictObject({
  browser: z.string().min(1),
  sandboxed: z.boolean(),
  loaded: z.boolean(),
  renderedTextChars: z.int().nonnegative(),
  blockedRequests: z.array(z.string()),
  pageErrors: z.array(z.string()),
  consoleErrors: z.array(z.string()),
});
export type BrowserCheck = z.infer<typeof BrowserCheck>;

export const Verdict = z.enum(["passed", "partial", "failed", "not-run"]);
export type Verdict = z.infer<typeof Verdict>;

/** Output of `fidelark verify --json`. */
export const VerificationResult = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  tool: Tool,
  generatedAt: z.iso.datetime(),
  input: InputInfo,
  /** True when every script, style, font, image and media file is embedded. */
  selfContained: z.boolean(),
  unbundled: z.array(Dependency),
  /** Null when the browser check was skipped or no browser was available. */
  browser: BrowserCheck.nullable(),
  verdict: Verdict,
  findings: z.array(Finding),
});
export type VerificationResult = z.infer<typeof VerificationResult>;
