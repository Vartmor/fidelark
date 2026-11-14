# Security policy

Fidelark processes untrusted files, so security reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through GitHub:
**Security → Report a vulnerability** on this repository.

Include the affected version or commit, a minimal input that reproduces the issue, and the
impact you observed. We aim to acknowledge reports within 7 days.

## Scope

In scope: input parsing and classification, size and archive limits, report generation, the
`convert` loaders (escaping the base directory, reaching non-public addresses, bypassing size,
time or redirect limits or integrity checks), the `verify` browser isolation (network or file
access, permissions, popups, downloads), and anything that could execute, fetch or leak content
from a file without the user asking for it.

Fidelark is pre-alpha. Only the latest commit on `main` is supported.

## Principles

- `inspect` and `convert` never execute the input.
- `convert` downloads nothing unless `--allow-network` is given, and then only from public
  addresses, with size, time and redirect limits.
- `verify` executes the file only inside a sandboxed browser with all network access, other
  local files, permissions, service workers, popups and downloads blocked.
- The CLI sends no content and no telemetry.
