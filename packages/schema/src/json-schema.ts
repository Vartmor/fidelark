import { z } from "zod";
import { ConversionResult, ExportManifest, VerificationResult } from "./export.ts";
import { FixtureManifest } from "./fixture.ts";
import { PortabilityReport } from "./report.ts";

/** Published JSON Schema files, keyed by file name under `packages/schema/json-schema/`. */
export function jsonSchemas(): Record<string, unknown> {
  return {
    "portability-report.schema.json": z.toJSONSchema(PortabilityReport),
    "fixture-manifest.schema.json": z.toJSONSchema(FixtureManifest),
    "export-manifest.schema.json": z.toJSONSchema(ExportManifest),
    "conversion-result.schema.json": z.toJSONSchema(ConversionResult),
    "verification-result.schema.json": z.toJSONSchema(VerificationResult),
  };
}

export function serializeJsonSchema(schema: unknown): string {
  return `${JSON.stringify(schema, null, 2)}\n`;
}
