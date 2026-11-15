# Fixture corpus

Test inputs for importers, the analyzer and offline verification. Every fixture is
**synthetic, openly licensed, or used with explicit consent**. Never store private conversations,
API keys or tokens here.

```text
fixtures/
  synthetic/    hand-written inputs, CC0
  public/       openly licensed inputs, with source URL
  adversarial/  malicious inputs for security tests (zip bombs, script injection, ...)
```

Each fixture is a directory named after its `id`, containing the artifact and a `fixture.json`
manifest that follows
[`fixture-manifest.schema.json`](../packages/schema/json-schema/fixture-manifest.schema.json).

```text
fixtures/synthetic/minimal-quiz/
  artifact.html
  fixture.json
```

## Manifest fields

| Field | Meaning |
|---|---|
| `category` | `react-jsx`, `html`, `html-zip`, `data-viz`, `markdown`, `connected`, `adversarial` |
| `source` | `synthetic`, `public` (with `url`) or `consented` (with `consentRecord`), always with a license |
| `artifact.sha256` | Hash of the artifact file; the test suite fails if the file changes |
| `expected` | Format, exact capability set, overall fidelity class, finding codes that must appear, and `offline`: the verdict of `fidelark verify` on the original file (`works` = passed, `partial`, `fails` = failed) |
| `baselines` | Results of the same artifact with existing free tools such as SingleFile or monolith |

`pnpm test` validates every manifest, checks the artifact hash, and runs `fidelark inspect` on the
artifact. For analyzed formats the report must match `expected` exactly: the same capabilities,
the same overall fidelity, and every listed finding code. A fixture is therefore a regression
test: add one whenever the analyzer learns something new or gets something wrong.

When a Chromium-based browser is available, every fixture is also opened offline with
`fidelark verify` and its verdict must match `expected.offline`.

## ZIP fixtures

ZIP archives are binary, so their contents live in
[`packages/core/scripts/zip-fixtures.ts`](../packages/core/scripts/zip-fixtures.ts), where they
can be reviewed. After changing one, rebuild the archives and update the hash in its
`fixture.json`:

```bash
node packages/core/scripts/zip-fixtures.ts
```

`tests/zip-fixtures.test.ts` fails if a committed archive differs from what the script builds.
`verify` opens HTML only, so ZIP fixtures use `"offline": "not-tested"`; the same test converts
the lesson export and verifies the result offline instead.

## Recording baseline comparisons

When comparing Fidelark with existing tools, add each collected artifact as a fixture, then record
each manual conversion as a `baselines` entry:

```json
{ "tool": "monolith", "offline": "partial", "notes": "Chart renders; live API fails silently." }
```

Get the hash with `sha256sum artifact.html`, or from `pnpm fidelark inspect artifact.html`.
