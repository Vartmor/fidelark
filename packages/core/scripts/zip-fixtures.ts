/**
 * Source of the ZIP fixtures in fixtures/. ZIP files are binary, so their contents are written
 * here, where they can be reviewed; tests/zip-fixtures.test.ts checks that every committed
 * archive is byte-for-byte what this file builds. Run it after changing a fixture:
 *
 *   node packages/core/scripts/zip-fixtures.ts
 *
 * then update the artifact hash in that fixture's fixture.json.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildZip, type ZipSpec } from "../src/testing.ts";

const lesson: ZipSpec[] = [
  {
    name: "lesson/index.html",
    content: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Photosynthesis in five minutes</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<main>
  <h1>Photosynthesis in five minutes</h1>
  <img src="images/leaf.svg" alt="A leaf turning light into sugar" width="240" height="160">
  <p>Plants turn light, water and carbon dioxide into sugar and oxygen.</p>
  <section id="quiz">
    <h2>Quick check</h2>
    <p>Which gas do plants release?</p>
    <button type="button" data-answer="right">Oxygen</button>
    <button type="button" data-answer="wrong">Nitrogen</button>
    <p id="result" aria-live="polite"></p>
  </section>
  <label>Light <input id="light" type="range" min="0" max="100" value="50"></label>
  <p>Sugar made per hour: <output id="rate">50</output> units</p>
</main>
<script src="app.js"></script>
</body>
</html>
`,
  },
  {
    name: "lesson/styles.css",
    content: `body { margin: 0; font: 16px/1.5 system-ui, sans-serif; color: #152d2b; }
main { max-width: 40rem; margin: 0 auto; padding: 2rem; background: url("images/grain.svg"); }
button { font: inherit; padding: 0.4rem 0.8rem; }
`,
  },
  {
    name: "lesson/app.js",
    content: `const result = document.getElementById("result");
for (const button of document.querySelectorAll("[data-answer]")) {
  button.addEventListener("click", () => {
    result.textContent = button.dataset.answer === "right" ? "Correct!" : "Not quite.";
  });
}
const light = document.getElementById("light");
light.addEventListener("input", () => {
  document.getElementById("rate").value = light.value;
});
`,
  },
  {
    name: "lesson/images/leaf.svg",
    content:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><path d="M20 140C60 20 200 20 220 20 200 120 120 150 20 140z" fill="#1e6c4e"/></svg>\n',
  },
  {
    name: "lesson/images/grain.svg",
    content:
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="1" height="1" fill="#e9e9e1"/></svg>\n',
  },
  // What macOS Finder adds when it compresses a folder.
  { name: "__MACOSX/lesson/._index.html", content: "\u0000\u0005\u0016\u0007 Mac OS X" },
  { name: "lesson/.DS_Store", content: "Bud1" },
];

const dashboard: ZipSpec[] = [
  {
    name: "index.html",
    content: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Q3 sales dashboard</title>
<script type="module" crossorigin src="/assets/index-3f9a1c.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-b71e02.css">
</head>
<body>
<div id="root"></div>
</body>
</html>
`,
  },
  {
    name: "assets/index-3f9a1c.js",
    content: `import { drawChart } from "./chart-9d2e4b.js";
const root = document.getElementById("root");
const region = localStorage.getItem("region") ?? "all";
const response = await fetch("https://api.example.com/v1/sales?quarter=3&region=" + region);
const rows = await response.json();
root.innerHTML = '<div class="logo"></div><canvas width="640" height="320"></canvas>';
drawChart(root.querySelector("canvas"), rows);
`,
  },
  {
    name: "assets/chart-9d2e4b.js",
    content: `export function drawChart(canvas, rows) {
  const ctx = canvas.getContext("2d");
  const max = Math.max(...rows.map((r) => r.total));
  rows.forEach((r, i) => {
    const h = (r.total / max) * canvas.height;
    ctx.fillRect(i * 40 + 10, canvas.height - h, 30, h);
  });
}
`,
  },
  {
    name: "assets/index-b71e02.css",
    content: `#root { font-family: system-ui, sans-serif; }
.logo { width: 120px; height: 32px; background: url(/assets/logo.png) no-repeat; }
`,
  },
];

const traversal: ZipSpec[] = [
  {
    name: "index.html",
    content:
      '<!doctype html><html><head><title>Shared notes</title><script src="../escape.js"></script></head><body><p>Shared notes</p></body></html>\n',
  },
  { name: "../escape.js", content: "console.log('written outside the folder');\n" },
  { name: "/etc/cron.d/fidelark", content: "# a scheduled job planted by an archive\n" },
  { name: "C:\\Users\\Public\\startup.bat", content: "rem runs at login\n" },
  { name: "notes", content: "/home", unixMode: 0o120777 },
  { name: "\u001b]0;pwned\u0007title.txt", content: "rewrites the terminal title\n" },
  { name: "index.html", content: "<p>A second index.html that would replace the first</p>\n" },
];

const kernel = "A".repeat(64 * 1024);
const bomb: ZipSpec[] = [
  { name: "index.html", content: "<!doctype html><title>Report</title><p>Quarterly report</p>\n" },
  // 20 MiB of zeros compresses to about 20 KB.
  { name: "data/zeros.bin", content: new Uint8Array(20 * 1024 * 1024) },
  // Overlapping entries: three names, one copy of the compressed data.
  { name: "parts/1.txt", content: kernel },
  { name: "parts/2.txt", content: kernel, shareDataOf: 2 },
  { name: "parts/3.txt", content: kernel, shareDataOf: 2 },
];

/** Fixture directory (relative to fixtures/) → archive bytes. */
export function zipFixtures(): Record<string, Uint8Array> {
  return {
    "synthetic/lesson-export-zip/artifact.zip": buildZip(lesson),
    "synthetic/dashboard-export-zip/artifact.zip": buildZip(dashboard),
    "adversarial/zip-path-traversal/artifact.zip": buildZip(traversal),
    "adversarial/zip-bomb/artifact.zip": buildZip(bomb),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL("../../../fixtures/", import.meta.url);
  for (const [path, bytes] of Object.entries(zipFixtures())) {
    await writeFile(new URL(path, root), bytes);
    console.log(`wrote fixtures/${path} (${bytes.byteLength} bytes)`);
  }
}
