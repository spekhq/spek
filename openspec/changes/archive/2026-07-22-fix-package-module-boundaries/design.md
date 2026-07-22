## Context

`buildGraphData` emits `change:<slug>`; `buildGraphDataAggregated` rewrites it to
`change:<worktreeKey>:<slug>` and attaches `source` (`packages/core/src/scanner.ts:398`, `:772`). The
code that reverses that lives in `packages/ui/src/graphNodeId.ts`, shipped in `@spekjs/ui@1.1.0`.

Core already publishes two **node-free subpaths** for precisely this situation — `./headings` and
`./artifact-order`. `artifact-order.ts` says why in its own header comment: it is pure constants and
functions so the webview bundle can value-import it, while `artifacts.ts` next door depends on `node:fs`
and is server-only. `openspec/specs/core-module/spec.md` already requires those subpaths to resolve for
external consumers.

Separately, `@spekjs/ui` is `"type": "module"` but `tsc` emits its relative specifiers verbatim and its
sources omit extensions, so `dist/index.js` says `from "./SpecGraph"` — which Node's ESM resolver
rejects. Core, with the same `"moduleResolution": "bundler"` tsconfig, writes `from "./scanner.js"` and
is loadable.

## Goals / Non-Goals

**Goals:**

- One home for the id format: the code that writes it and the code that reads it in the same package.
- A Node-safe way to import that parsing without pulling React, d3, or `node:fs`.
- `@spekjs/ui`'s published output loadable by Node ESM, and a guard so it stays that way.
- No break for anyone who adopted `@spekjs/ui@1.1.0` an hour ago.

**Non-Goals:**

- Changing the node id format itself. It is specified (`graph-view`, `openspec-api`) and other consumers
  depend on it.
- Giving `@spekjs/ui` a full set of granular subpath exports. One import path stops being a problem once
  the helper is in core; inventing a subpath surface for the components is a separate question.
- Adding a CommonJS build. Both packages are ESM-only and stay that way.

## Decisions

**The helper moves to `packages/core/src/graph-node-id.ts`, exported as `@spekjs/core/graph-node-id`.**
Same shape as `artifact-order.ts` — pure logic, no runtime imports. Its one import is `import type
{ GraphNode } from "./types.js"`, which erases (core sets `isolatedModules` and no `verbatimModuleSyntax`;
`dist/types.js` is literally `export {};` for the same reason). It sits beside `scanner.ts`, so a future change to the id format has one
directory where both the producer and the parser are visible. Alternative considered — adding subpath
exports to `@spekjs/ui` so the downstream could import just that file — rejected: it unblocks the import
but preserves the producer/parser split, which is the actual cause of #25.

**`@spekjs/ui` re-exports `changeNodeSlug` rather than dropping it.** It became public in 1.1.0; removing
it in the next version to make a structural point would be churn paid for by consumers. The re-export
costs one line, and ui's own components import from core directly rather than through their own re-export
(one hop, not two).

**Core's peer range in `@spekjs/ui` must be raised.** It is `>=1.0.0` today. Once ui imports
`@spekjs/core/graph-node-id` at runtime, an installation that satisfies the old range resolves to a core
without that subpath and fails at import time. The type checker will not see it either: `skipLibCheck`,
on in most consumer tsconfigs, suppresses the unresolved specifier inside `@spekjs/ui`'s own `.d.ts`.
Inside this monorepo the floor is never exercised at all — every package declares `"@spekjs/core": "*"`
and resolves the workspace symlink. The floor moves to the core version that introduces the subpath
(core is at 1.2.0, so 1.3.0), and `packages/ui/README.md` states the range too.

**This is the first runtime import of core from ui.** Until now every `import` in `packages/ui/src` was
`import type`, erased at compile time — which is why the peer dependency was never actually exercised, and
why #27 has stayed invisible. The two fixes belong in one change for this reason: after this, ui's dist
genuinely resolves core at runtime.

**Guard for #27: `moduleResolution: "nodenext"` in ui's tsconfig.** `nodenext` makes `tsc` itself reject an
extensionless relative specifier, and it is the guard that **cannot be routed around**: `npm run build:ui`
is invoked by `npm run build`, `build:webview`, `build:intellij`, `build:demo`, `action.yml`, and — the one
that matters — ui's own `prepublishOnly`. A broken package cannot be published past it.

The test-based alternative (read the package's sources, assert every relative specifier carries an
extension) is a genuinely **weaker** fallback here, and the obvious argument for it is wrong: nothing in
`.github/workflows/` runs `npm test`. It fires only when a human types it. Take it only if `nodenext`
proves unworkable, and pair it with adding a test job to CI.

This was trialled rather than assumed: a scratch copy of `packages/ui/src` under `module`/
`moduleResolution: nodenext` reports 21 × `TS2835` before extensions are added and **zero errors** after —
React 19 JSX, all five `d3-*` packages and both core entry points resolve. The five implicit-`any` errors
that appear alongside the `TS2835`s are downstream of the unresolved imports, not independent.

**Not** acceptable: fixing the specifiers with no guard at all — no consumer in this repo would notice a
regression, since they all bundle.

## Risks / Trade-offs

- **A consumer on `@spekjs/ui@1.1.0` with an old `@spekjs/core`.** Handled by raising the peer range, but
  npm only warns on peer conflicts by default — someone who ignores the warning gets a runtime resolution
  error rather than an install failure. Worth stating plainly in the release note.
- **Build order becomes load-bearing.** Root `build:webview` and `build:intellij` (`package.json:16`, `:21`)
  build ui but **not** core. That is harmless today because ui's dist has no runtime edge to core; once it
  does, a stale `packages/core/dist/graph-node-id.js` breaks both at Vite resolve time. Install-time
  `prepare` masks it; an incremental local edit does not. Both scripts get `npm run build:core` prefixed.
- **Two version lines move together.** ui's new floor is a core version that must be published first, or
  ui's release is momentarily uninstallable from the registry. Order matters: core, then ui.
- **The bug this prevents is invisible in this repo.** Everything here bundles, so neither #27 nor a future
  producer/parser drift would show up in local development. The guard and the co-location are the whole
  protection; there is no test that would otherwise catch it.
