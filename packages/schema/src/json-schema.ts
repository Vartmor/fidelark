import { z } from "zod";
import { FixtureManifest } from "./fixture.ts";
import { PortabilityReport } from "./report.ts";

/** Published JSON Schema files, keyed by file name under `packages/schema/json-schema/`. */
export function jsonSchemas(): Record<string, unknown> {
  return {
    "portability-report.schema.json": z.toJSONSchema(PortabilityReport),
    "fixture-manifest.schema.json": z.toJSONSchema(FixtureManifest),
  };
}

export function serializeJsonSchema(schema: unknown): string {
  return `${JSON.stringify(schema, null, 2)}\n`;
}
