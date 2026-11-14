<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="branding/assets/logo/svg/lockup-paper.svg">
    <img src="branding/assets/logo/svg/lockup-ink.svg" alt="Fidelark" width="280">
  </picture>
</p>

<p align="center"><strong>Your work. Beyond the chat.</strong></p>

Fidelark keeps AI-generated work usable beyond the platform where it was made. It inspects
interactive AI artifacts (HTML, React/JSX, Markdown, ZIP exports), shows what survives offline
and what doesn't, and exports them as portable files: **Import. Inspect. Preserve. Export.**

> **Status:** pre-alpha, validation phase. Only `inspect` exists today: it classifies a file and
> prints a schema-versioned portability report. Static analysis, fidelity assessment and export
> are not implemented yet.

## Principles

- **Local-first:** everything runs on your machine; the CLI sends no content and no telemetry.
- **Safe by default:** inputs are never executed during inspection.
- **Honest portability:** fidelity is reported per axis with evidence, never guessed.

## Usage

Requires Node.js 24 and pnpm.

```bash
pnpm install
pnpm fidelark inspect path/to/artifact.html
pnpm fidelark inspect path/to/artifact.html --json
```

Exit codes: `0` report produced, `1` report contains errors, `2` usage or input error.

## Repository layout

```text
packages/
  schema/     contracts (Zod) and published JSON Schema: fidelity classes, reports, fixtures
  core/       input classification, limits, inspection pipeline
  cli/        the `fidelark` command
fixtures/     test corpus with manifests (see fixtures/README.md)
tests/        cross-package tests (fixture corpus, brand asset integrity)
branding/     brand identity: logos, tokens, UI kit, guidelines (see branding/README.md)
docs/adr/     architecture decision records
```

## Development

```bash
pnpm check         # lint + typecheck + test
pnpm format        # apply formatting and safe lint fixes
pnpm schema:emit   # regenerate JSON Schema after changing packages/schema
```

TypeScript runs directly on Node's built-in type stripping, so there is no build step;
see [ADR-008](docs/adr/0008-monorepo-ve-arac-secimi.md).

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
