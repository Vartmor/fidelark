<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="branding/assets/logo/svg/lockup-paper.svg">
    <img src="branding/assets/logo/svg/lockup-ink.svg" alt="Fidelark" width="280">
  </picture>
</p>

<p align="center"><strong>Your work. Beyond the chat.</strong></p>

<p align="center">English · <a href="README.tr.md">Türkçe</a> · <a href="https://vartmor.github.io/fidelark/">Website</a></p>

> [!IMPORTANT]
> **Fidelark is under active development (pre-alpha).** The CLI, the report format and the
> APIs can change without notice. It is not ready for production use yet.

Fidelark keeps AI-generated work usable beyond the platform where it was made. It inspects
interactive AI artifacts (HTML, React/JSX, Markdown, ZIP exports), shows what survives offline
and what doesn't, and exports them as portable files: **Import. Inspect. Preserve. Export.**

## Contents

- [What works today](#what-works-today)
- [Principles](#principles)
- [Usage](#usage)
- [Convert and verify](#convert-and-verify)
- [Example report](#example-report)
- [Fidelity classes](#fidelity-classes)
- [Roadmap](#roadmap)
- [Repository layout](#repository-layout)
- [Development](#development)
- [Brand](#brand)
- [License](#license)

## What works today

`fidelark inspect` analyzes a **single HTML file** without executing it and writes a
schema-versioned portability report:

- **Dependencies:** scripts, modules, stylesheets, fonts, images, media, frames and runtime
  network requests, each marked remote, relative, embedded or bare, with line numbers.
- **Permissions:** whether the artifact needs scripts, network access or browser storage.
- **Fidelity:** content, visual and behavioral fidelity assessed separately, each with evidence.
- **Findings:** remote and missing files, network calls, remote forms and frames, dynamic code,
  APIs that exist only inside an AI platform, and possible credentials (always redacted).

`fidelark convert` bundles an HTML file and its scripts, stylesheets, fonts, images and media into
**one self-contained HTML file**, with a provenance manifest inside it. `fidelark verify` opens a
file in a **sandboxed browser with all network access blocked** and reports what it tried to
load and which errors it raised.

Other formats (React/JSX source, Markdown, ZIP) are recognized but not analyzed or converted yet.
ES module graphs, embedded pages and live network calls stay external, and conversions say so.

## Principles

- **Local-first:** everything runs on your machine; the CLI sends no content and no telemetry.
- **Safe by default:** `inspect` and `convert` never execute the input. `convert` reads local
  files only from the input's folder and downloads only with `--allow-network`, only from public
  addresses. `verify` runs the file only inside a sandboxed browser with the network blocked.
- **Honest portability:** fidelity is reported per axis with evidence, never as a percentage.
- **Deterministic:** the same input always gives the same report; no AI model is involved.

## Usage

Requires Node.js 24 and pnpm.

```bash
pnpm install
pnpm fidelark inspect path/to/artifact.html
pnpm fidelark inspect path/to/artifact.html --json
```

Exit codes: `0` success, `1` problems found (errors in the report, failed embeds, or a verify
verdict other than passed), `2` usage or input error. JSON output follows the schemas in
[`packages/schema/json-schema/`](packages/schema/json-schema/).

## Convert and verify

```bash
# Bundle local dependencies into one file (writes artifact.fidelark.html)
pnpm fidelark convert path/to/artifact.html

# Also download remote scripts, stylesheets, fonts and images (public addresses only)
pnpm fidelark convert path/to/artifact.html --allow-network -o portable.html

# Open the result offline in a sandboxed Chromium and report what breaks
pnpm fidelark verify portable.html
```

`convert` checks Subresource Integrity hashes, keeps `defer`/`async` semantics, removes resource
hints that would only fail offline, and refuses files outside the input's folder (or `--base`).
Every output carries a `<script type="application/json" id="fidelark-export">` manifest listing
each embedded resource with its SHA-256, and each reference left external with the reason.

`verify` needs Chrome, Chromium or Edge (set `FIDELARK_BROWSER` to a custom path). Its verdict is
**passed** (no blocked requests, no errors), **partial** (opens, but something is blocked, raises
errors or needs a connection) or **failed** (does not load, or stays blank while failing). It
only loads the page; it does not click or type.

## Example report

A chart widget that loads Chart.js from a CDN and fetches live data
([fixture](fixtures/synthetic/live-data-widget/artifact.html)):

```text
$ pnpm fidelark inspect fixtures/synthetic/live-data-widget/artifact.html
  File      artifact.html
  Format    html
  Size      866 B
  SHA-256   a1a638cedcb17332b4d6eb3ad452651b661b0ffd92f23544ebc650543f8b8ded
  Fidelity  ↗ Connected  (static analysis, not yet verified offline)
            content     ● Exact portable
              · 26 characters of static text are in the document.
            visual      ● Exact portable
              · All styles and images are inline or embedded.
            behavioral  ↗ Connected
              · Makes 1 network request at runtime: https://api.example.com/rates?base=EUR (fetch() line 13).
              · 1 remote script can be bundled for offline use.
  Needs     scripts, network
  Uses      html, inline-script, external-script, canvas, network-fetch

Dependencies (2)
  script   remote  https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js  (<script src> line 6)
  network  remote  https://api.example.com/rates?base=EUR  (fetch() line 13)

Findings
  warning  dependency.remote    1 remote resource must be bundled for the artifact to work offline.
                                - script: https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js
  warning  network.runtime      Makes 1 network request at runtime; these features need a connection.
                                - https://api.example.com/rates?base=EUR (fetch() line 13)
  info     script.inline        Contains 1 inline script. Nothing is executed during inspection.
  info     fidelity.unverified  Fidelity is assessed by static analysis; it is not yet verified by exporting and reopening the artifact offline.
```

## Fidelity classes

Six named outcomes, from most to least portable. The overall class is the worst of the three axes.

| Class | Meaning |
|---|---|
| ● Exact portable | Source semantics and behavior preserved independently. |
| ▣ Bundled portable | Dependencies packaged, verified in the target environment. |
| ≈ Semantic equivalent | Meaning preserved with different presentation. |
| ↗ Connected | Some behavior requires network/API. |
| ◧ Static fallback | Source/snapshot kept, not interactive. |
| × Unsupported | Not safe or feasible; the report explains why. |

The rules that map findings to classes are documented in
[ADR-010](docs/adr/0010-html-statik-analiz-ve-fidelity-kurallari.md).

## Roadmap

- [x] Input classification, size limits and schema-versioned reports
- [x] Static analysis and fidelity assessment for single HTML files
- [x] Standalone HTML export with automated offline verification
- [ ] React/JSX artifact source → runnable offline HTML
- [ ] Bundling ES module graphs
- [ ] ZIP export inspection
- [ ] Sandboxed local preview

## Repository layout

```text
packages/
  schema/     contracts (Zod) and published JSON Schema: fidelity classes, reports, fixtures
  core/       input classification, limits, inspection pipeline
  analyzer/   static HTML, CSS and JavaScript analysis; fidelity rules
  exporter/   standalone HTML export with permissioned local and network loaders
  verifier/   offline verification in a sandboxed browser
  cli/        the `fidelark` command
fixtures/     test corpus with expected results (see fixtures/README.md)
apps/site/    promo website on GitHub Pages (Vite, React; reports generated from fixtures)
tests/        cross-package tests (fixture corpus, brand asset integrity, site data)
branding/     brand identity: logos, tokens, UI kit, guidelines (see branding/README.md)
docs/adr/     architecture decision records
```

## Development

```bash
pnpm check         # lint + typecheck + test + site build
pnpm format        # apply formatting and safe lint fixes
pnpm schema:emit   # regenerate JSON Schema after changing packages/schema
pnpm site:dev      # run the website locally (its reports are built from fixtures/)
```

TypeScript runs directly on Node's built-in type stripping, so there is no build step;
see [ADR-008](docs/adr/0008-monorepo-ve-arac-secimi.md). Every fixture's expected capabilities,
fidelity and findings are checked on each test run, and, when a browser is available, its
offline verdict too, so changes show up as regressions. Export and verification decisions are in
[ADR-011](docs/adr/0011-standalone-html-export-ve-cevrimdisi-dogrulama.md).

## Brand

Logos, colors, type, voice and the six fidelity labels are defined in
[`branding/`](branding/README.md); SVG files under `branding/assets/logo/svg/` are the masters.
`pnpm test` checks the brand asset manifest, SVG safety, token consistency and the contrast
audit. Fidelark is a candidate name and identity, pending trademark clearance.

## License

Code is licensed under the [Apache License 2.0](LICENSE). The Fidelark name, logos and brand
assets are not covered by that license; see [TRADEMARKS.md](TRADEMARKS.md) and
[branding/LICENSE.md](branding/LICENSE.md).

Contributions are welcome under the [Developer Certificate of Origin](CONTRIBUTING.md#developer-certificate-of-origin).
Please report security issues privately; see [SECURITY.md](SECURITY.md).
