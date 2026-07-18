# Security Policy

## Supported versions

spek ships through several channels — the npm packages `@spekjs/core` and `@spekjs/ui`, the VS Code
extension, the IntelliJ plugin, and the `spekhq/spek` GitHub Action. Security fixes are applied to
the **latest released version** of each. Please make sure you can reproduce an issue on the latest
release before reporting.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues or pull requests.**

Instead, report privately by **email to cpckewang@gmail.com**.

Please include as much of the following as you can:

- The affected surface (`@spekjs/core`, `@spekjs/ui`, Web app, VS Code extension, IntelliJ plugin,
  or the GitHub Action) and version.
- A description of the vulnerability and its impact.
- Step-by-step instructions to reproduce it, ideally with a minimal proof of concept.
- Any suggested remediation, if you have one.

## What to expect

- We aim to acknowledge your report within **5 business days**.
- We'll confirm the issue, keep you updated on progress, and let you know when a fix ships.
- We're happy to credit you in the release notes once the fix is public, unless you'd prefer to
  stay anonymous.

## Scope notes

spek is designed to be **read-only** and **local-only** — it reads a local `openspec/` directory
and never writes to your project or sends data off your machine. The security surfaces most worth
scrutiny are therefore:

- **Local file access** — the Web/IntelliJ servers should only ever read `.md` / `.yaml` files
  under an `openspec/` directory. Any path-traversal or arbitrary-file-read beyond that is
  in scope.
- **The published npm packages** (`@spekjs/core`, `@spekjs/ui`) as consumed by third-party hosts.
- **The `spekhq/spek` composite GitHub Action**, which runs in users' CI.

Thank you for helping keep spek and its users safe.
