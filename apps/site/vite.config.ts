import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { buildSiteReports, FIXTURES } from "./scripts/site-reports.ts";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

/** Ships the brand's social card at a fixed path, so og:image can use an absolute URL. */
function socialImage(): Plugin {
  return {
    name: "fidelark-social-image",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "social.png",
        source: readFileSync(`${repoRoot}branding/assets/social/github-1280x640.png`),
      });
    },
  };
}

/**
 * Serves `virtual:site-reports`: real `fidelark inspect` output for the repository's fixtures,
 * computed on every build and dev start, so the scanner belt cannot drift from the CLI. In dev,
 * editing a fixture reloads the page; engine changes need a dev server restart.
 */
function siteReports(): Plugin {
  const id = "virtual:site-reports";
  const resolved = `\0${id}`;
  return {
    name: "fidelark-site-reports",
    resolveId: (source) => (source === id ? resolved : undefined),
    async load(source) {
      if (source !== resolved) return;
      return `export default ${JSON.stringify(await buildSiteReports())};`;
    },
    configureServer(server) {
      server.watcher.add(FIXTURES);
      const reload = (file: string) => {
        if (!file.startsWith(FIXTURES)) return;
        const client = server.environments.client;
        const module = client.moduleGraph.getModuleById(resolved);
        if (module) client.moduleGraph.invalidateModule(module);
        client.hot.send({ type: "full-reload" });
      };
      server.watcher.on("add", reload).on("change", reload).on("unlink", reload);
    },
  };
}

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the project site under /fidelark/.
  base: command === "build" ? "/fidelark/" : "/",
  plugins: [react(), tailwindcss(), socialImage(), siteReports()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Favicons and the web manifest come straight from the brand package.
  publicDir: `${repoRoot}branding/assets/favicon`,
  server: {
    port: 5173,
    strictPort: true,
    // Brand tokens and logos are imported from ../../branding.
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
}));
