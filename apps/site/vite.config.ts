import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

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

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the project site under /fidelark/.
  base: command === "build" ? "/fidelark/" : "/",
  plugins: [react(), tailwindcss(), socialImage()],
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
