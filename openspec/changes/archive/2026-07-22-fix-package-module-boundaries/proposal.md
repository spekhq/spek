## Why

Two defects in what the published packages expose, both found by a downstream host (spekterm) trying to
use them outside a bundler:

- **The producer and the parser of the graph node id live in different packages.** `@spekjs/core` decides
  that an aggregated change node is `change:<worktreeKey>:<slug>`; `@spekjs/ui` is where the code that
  turns that back into a slug lives. That split is what allowed issue #25 — core started namespacing ids,
  ui's parser didn't follow, and nothing failed loudly. Extracting `changeNodeSlug()` into ui made ui's
  two consumers agree with each other; it did not make them agree with core. A host that needs the same
  parsing in a Node main process can't reach it: `@spekjs/ui` has no subpath exports, so the only entry
  pulls in `SpecGraph` — JSX, d3, React — and it ends up hand-rolling a second copy (issue #28).
- **`@spekjs/ui`'s published output isn't loadable by Node ESM at all.** The package is `"type": "module"`
  but its dist emits extensionless relative specifiers (`from "./SpecGraph"`), which Node's ESM resolver
  rejects. Every current consumer bundles, so nothing has failed yet — and `@spekjs/core`, with the same
  tsconfig, writes extensions and is fine (issue #27).

These are one change because they are the same seam: what each package publishes and who is allowed to
import it. Fixing #28 makes `@spekjs/ui` import `@spekjs/core` at **runtime** for the first time, which
is exactly the path #27 breaks.

## What Changes

- Move node-id parsing into `@spekjs/core`, beside the code that produces the format, exposed as a
  **node-free subpath** (`@spekjs/core/graph-node-id`) — the pattern core already uses for `./headings`
  and `./artifact-order`, so a browser or Node-main-process consumer can import it without pulling in
  `node:fs` or `cross-spawn`.
- `@spekjs/ui` consumes it from there and **re-exports `changeNodeSlug` unchanged**. The export shipped in
  `@spekjs/ui@1.1.0` keeps working — this is not a breaking change for anyone who just adopted it.
- Make `@spekjs/ui`'s published output valid Node ESM (extensions on relative specifiers), plus a guard
  that fails the build or the tests when a new file reintroduces the problem. Without a guard nothing
  would notice: every consumer in this repo bundles.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `core-module`: core owns graph node id parsing and publishes it as a node-free subpath alongside
  `headings` / `artifact-order`.
- `ui-package`: the shared-helper requirement changes owner — the helper comes from core rather than
  living in ui — and the package gains a requirement that its published output is importable by Node ESM,
  not only by bundlers.

## Impact

- `packages/core/src/graph-node-id.ts` (new), `packages/core/package.json` `exports`
- `packages/ui/src/graphNodeId.ts` — becomes a re-export, or is deleted with `index.ts` re-exporting core's
- `packages/ui/src/**` — extensions added to relative specifiers; `packages/ui/tsconfig.json` may move to
  `nodenext` resolution if that is the guard chosen
- `@spekjs/core` and `@spekjs/ui` both need a release; **the CHANGELOG entries and version bumps are not
  part of this change** — for the release to record: core gains a public subpath (additive), ui's fix is
  packaging-only with no API change, and ui's `changeNodeSlug` export is preserved
- **Two constraints the release must honour**, because the change writes a peer floor of `>=1.3.0` into
  `packages/ui/package.json`: core must go out as **1.3.0** (a minor — it is additive — not a patch), and
  **core must be published before ui**, or ui is momentarily uninstallable from the registry
- No behavior change in any of Web / VS Code / IntelliJ / Demo — the parsing is identical, only its home
  and the module graph move
