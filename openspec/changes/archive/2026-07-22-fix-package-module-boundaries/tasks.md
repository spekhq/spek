## 1. Move the parser into core

- [x] 1.1 Add `packages/core/src/graph-node-id.ts` — `changeNodeSlug(node: GraphNode): string`, moved from
      `packages/ui/src/graphNodeId.ts` unchanged, with only `import type` from `./types.js` so the module
      stays free of any runtime dependency (same shape as `artifact-order.ts`; say so in the header comment)
- [x] 1.2 Move the helper's unit tests to `packages/core/src/graph-node-id.test.ts`, keeping the
      already-normalised-id case — it is the one that documents why the guard exists
- [x] 1.3 Add the `./graph-node-id` subpath to `packages/core/package.json` `exports`, alongside
      `./headings` and `./artifact-order`
- [x] 1.4 Export `changeNodeSlug` from core's index too, so `@spekjs/core` consumers who don't need the
      Node-free entry point aren't forced to a subpath (this follows `headings`, which is exported from
      both; `artifact-order` is subpath-only)

## 2. Consume it from ui

- [x] 2.1 `packages/ui/src/SpecGraph.tsx` and `packages/ui/src/timeline/grouping.ts` import from
      `@spekjs/core/graph-node-id`; delete `packages/ui/src/graphNodeId.ts`
- [x] 2.2 `packages/ui/src/index.ts` re-exports `changeNodeSlug` from `@spekjs/core/graph-node-id` — the
      1.1.0 export must keep resolving
- [x] 2.3 Raise the `@spekjs/core` peer range in `packages/ui/package.json` from `>=1.0.0` to `>=1.3.0`
      (core is at 1.2.0; the subpath ships in the next minor). An install satisfying the old range resolves
      a core without the subpath and fails at runtime; `skipLibCheck` hides it from the type checker, and
      inside this monorepo `"@spekjs/core": "*"` means the floor is never exercised at all
- [x] 2.4 Update `packages/ui/README.md`: say where `changeNodeSlug` now lives (still exported from the
      package), **and** correct the peer-dependency line — it currently reads "`@spekjs/core` >= 1"

## 3. Make ui's output valid Node ESM

- [x] 3.1 Add file extensions to every relative specifier in `packages/ui/src/**`, **including
      `src/**/__tests__/`** — tsconfig excludes those from the build, so `tsc` won't force them, but `tsx`
      runs them
- [x] 3.2 Set `"module": "nodenext"` + `"moduleResolution": "nodenext"` in `packages/ui/tsconfig.json` as
      the guard: `tsc` then rejects an extensionless specifier, and `build:ui` runs from `prepublishOnly`,
      so a broken package cannot be published. Trialled on a scratch copy already — 21 × `TS2835` before
      3.1, zero errors after; the implicit-`any` errors that appear alongside are downstream of the
      unresolved imports, not a nodenext cascade
- [x] 3.3 **Not needed** — 3.2 came out clean (`tsc` under nodenext builds with zero errors), so the
      compiler is the guard and the weaker test-based fallback is not taken. Kept here for the record:
      Only if 3.2 unexpectedly fails: add the guard as a test at
      `packages/ui/src/__tests__/module-specifiers.test.ts` (ui's glob matches **only** under `__tests__`;
      anywhere else it silently never runs) that asserts every relative specifier carries an extension —
      and note that no workflow runs `npm test`, so this guard fires only when a human runs it. Shipping
      3.1 with no guard at all is not an option
- [x] 3.4 Verify the built package actually imports from plain Node:
      `node --input-type=module -e "import('@spekjs/ui').then(m => console.log(Object.keys(m).length))"`
      after `npm run build:ui`

## 4. Build chain

- [x] 4.1 Prefix root `build:webview` and `build:intellij` (`package.json:16`, `:21`) with
      `npm run build:core`. They build ui but not core today, which is harmless only while ui's dist has no
      runtime edge to core — after this change a stale `packages/core/dist/graph-node-id.js` breaks both at
      Vite resolve time

## 5. Verification

- [x] 5.1 `npm test`, `npm run build:ui`, `npm run build:core`, `npm run type-check`
- [x] 5.2 Build every target that consumes ui — `npm run build`, `npm run build:webview`,
      `npm run build:intellij`, `NODE_ENV=production npm run build:demo` — since this change alters ui's
      module graph, and a subpath that a bundler cannot resolve would surface here and nowhere else
- [x] 5.3 Confirm the timeline still groups by topic under aggregation, by the same route as the #25 fix
      (temporary second worktree, `buildGraphDataAggregated` → `buildLanes`)
