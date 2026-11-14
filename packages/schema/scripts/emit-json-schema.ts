import { mkdir, writeFile } from "node:fs/promises";
import { jsonSchemas, serializeJsonSchema } from "../src/index.ts";

const outDir = new URL("../json-schema/", import.meta.url);
await mkdir(outDir, { recursive: true });

for (const [file, schema] of Object.entries(jsonSchemas())) {
  await writeFile(new URL(file, outDir), serializeJsonSchema(schema));
  console.log(`wrote packages/schema/json-schema/${file}`);
}
