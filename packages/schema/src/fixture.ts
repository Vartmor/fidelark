import { z } from "zod";
import { FidelityClass } from "./fidelity.ts";
import { InputFormat, SCHEMA_VERSION, Sha256 } from "./report.ts";

/** Corpus categories; see fixtures/README.md. */
export const FixtureCategory = z.enum([
  "react-jsx",
  "html",
  "html-zip",
  "data-viz",
  "markdown",
  "connected",
  "adversarial",
]);
export type FixtureCategory = z.infer<typeof FixtureCategory>;

export const OfflineResult = z.enum(["works", "partial", "fails", "not-tested"]);
export type OfflineResult = z.infer<typeof OfflineResult>;

/**
 * Every fixture must be synthetic, openly licensed, or used with explicit consent.
 * Secrets and private conversations are never stored.
 */
export const FixtureSource = z.discriminatedUnion("origin", [
  z.strictObject({ origin: z.literal("synthetic"), license: z.string().min(1) }),
  z.strictObject({
    origin: z.literal("public"),
    license: z.string().min(1),
    url: z.url(),
  }),
  z.strictObject({
    origin: z.literal("consented"),
    license: z.string().min(1),
    consentRecord: z.string().min(1),
  }),
]);

/** Result of converting the same artifact with an existing free tool, for baseline comparison. */
export const BaselineResult = z.strictObject({
  tool: z.string().min(1),
  version: z.string().min(1).optional(),
  offline: OfflineResult,
  notes: z.string().optional(),
});
export type BaselineResult = z.infer<typeof BaselineResult>;

export const FixtureManifest = z.strictObject({
  /** Optional editor hint pointing at the published JSON Schema. */
  $schema: z.string().optional(),
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case id"),
  title: z.string().min(1),
  category: FixtureCategory,
  provider: z.string().min(1).optional(),
  source: FixtureSource,
  artifact: z.strictObject({
    /** Path relative to the fixture directory. */
    path: z.string().min(1),
    sha256: Sha256,
  }),
  expected: z.strictObject({
    format: InputFormat,
    capabilities: z.array(z.string()),
    fidelity: FidelityClass,
    offline: OfflineResult,
    security: z.array(z.string()),
  }),
  baselines: z.array(BaselineResult),
  browserMatrix: z.array(z.string()).optional(),
  notes: z.string().optional(),
});
export type FixtureManifest = z.infer<typeof FixtureManifest>;
