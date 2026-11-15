# Security policy

Fidelark processes untrusted files, so security reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through GitHub:
**Security → Report a vulnerability** on this repository.

Include the affected version or commit, a minimal input that reproduces the issue, and the
impact you observed. We aim to acknowledge reports within 7 days.

## Scope

In scope: input parsing and classification, ZIP reading (entries that escape the archive,
symbolic links, ZIP bombs, headers that lie about sizes), size and archive limits, report
generation, the `convert` loaders (escaping the base directory or the archive, reaching
non-public addresses, bypassing size, time or redirect limits or integrity checks), the `verify`
browser isolation (network or file access, permissions, popups, downloads), and anything that
could execute, fetch or leak content from a file without the user asking for it.

Fidelark is pre-alpha. Only the latest commit on `main` is supported.

## Principles

- `inspect` and `convert` never execute the input.
- ZIP archives are read in memory and never extracted. Entries with unsafe paths, symbolic links,
  encryption, overlapping data or mismatched sizes or checksums are skipped and reported, and
  entries that expand like ZIP bombs are refused before decompression.
- `convert` downloads nothing unless `--allow-network` is given, and then only from public
  addresses, with size, time and redirect limits.
- `verify` executes the file only inside a sandboxed browser with all network access, other
  local files, permissions, service workers, popups and downloads blocked. Below that, the
  browser process itself can reach nothing: its proxy is a local dead end, it resolves no
  hostnames and WebRTC cannot send UDP. A page that hangs or navigates away is reported, never
  waited on.
- Parsing stays linear in the input size: no regular expression may backtrack across the input,
  and no tree walk recurses, so hostile input cannot stall or crash `inspect` or `convert`.

The threat model and a red-team checklist, each item backed by an automated test, are in
[ADR-002](docs/adr/0002-guvenilmeyen-girdi-tehdit-modeli-ve-sandbox.md).
- The CLI sends no content and no telemetry.
