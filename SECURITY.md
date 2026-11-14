# Security policy

Fidelark processes untrusted files, so security reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through GitHub:
**Security → Report a vulnerability** on this repository.

Include the affected version or commit, a minimal input that reproduces the issue, and the
impact you observed. We aim to acknowledge reports within 7 days.

## Scope

In scope: input parsing and classification, size and archive limits, report generation, and
anything that could execute, fetch or leak content from an inspected file.

Fidelark is pre-alpha. Only the latest commit on `main` is supported.

## Principles

- Inspected inputs are never executed.
- The CLI sends no content and no telemetry.
- Network access and script execution in future renderers are denied by default.
