# Contributing

Thanks for your interest. Fidelark is pre-alpha; issues describing AI artifacts that broke when
you tried to keep them are as valuable as code.

## Development

Requires Node.js 24 and pnpm.

```bash
pnpm install
pnpm check   # lint + typecheck + test
```

See the [README](README.md) for the repository layout and
[`docs/adr/`](docs/adr/README.md) for architecture decisions.

## Pull requests

- Keep changes focused; one topic per pull request.
- Commit messages are short and descriptive, one line.
- `pnpm check` must pass locally. There is no hosted CI: run it before every push. Browser
  tests run when Chrome, Chromium or Edge is installed (or `FIDELARK_BROWSER` is set).
- Changes to `packages/schema` require `pnpm schema:emit` and, for breaking changes, a
  `SCHEMA_VERSION` bump.

## Fixtures

Fixtures must be synthetic, openly licensed, or used with the owner's explicit consent. Never add
private conversations, API keys, tokens or personal data. See [fixtures/README.md](fixtures/README.md).

## Brand assets

Files in `branding/` are not covered by the Apache License. Do not modify logos or brand assets in
pull requests; see [TRADEMARKS.md](TRADEMARKS.md).

## Developer Certificate of Origin

Contributions are accepted under the Apache License 2.0. Each commit must be signed off to certify
the [Developer Certificate of Origin](https://developercertificate.org/):

```bash
git commit -s -m "Short description"
```

This adds a `Signed-off-by: Your Name <you@example.com>` line to the commit message.
