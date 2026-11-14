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
| `expected` | Format, capabilities, fidelity class, offline result and security expectations |
| `baselines` | Results of the same artifact with existing free tools such as SingleFile or monolith |

`pnpm test` validates every manifest, checks the artifact hash, and checks that `fidelark inspect`
detects the expected format.

## Recording baseline comparisons

When comparing Fidelark with existing tools, add each collected artifact as a fixture, then record
each manual conversion as a `baselines` entry:

```json
{ "tool": "monolith", "offline": "partial", "notes": "Chart renders; live API fails silently." }
```

Get the hash with `sha256sum artifact.html`, or from `pnpm fidelark inspect artifact.html`.
