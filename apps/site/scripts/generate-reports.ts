/**
 * Writes src/data/reports.json: real `fidelark inspect` output for the repository's fixtures,
 * shown on the site's scanner belt. Run with `pnpm site:data` after fixtures or the analyzer
 * change; tests/site-data.test.ts fails while the file is stale.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildSiteReports } from "./site-reports.ts";

const out = fileURLToPath(new URL("../src/data/reports.json", import.meta.url));
const reports = await buildSiteReports();
await writeFile(out, `${JSON.stringify(reports, null, 2)}\n`);
console.log(`wrote ${reports.length} reports to apps/site/src/data/reports.json`);
