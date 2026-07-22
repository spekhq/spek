## 1. Shared node-id helper

- [x] 1.1 Add `packages/ui/src/graphNodeId.ts` exporting `changeNodeSlug(node: GraphNode): string` — strip
      `change:`, then strip `${node.source.key}:` when `source` is present **and the remainder starts with
      it** (the guard is load-bearing: a host that pre-normalised its ids must not lose the head of its slug)
- [x] 1.2 Export `changeNodeSlug` from `packages/ui/src/index.ts`
- [x] 1.3 Use the helper in `SpecGraph.tsx`'s node click handler, keeping `d.source.key` as the callback's
      second argument (no behaviour change)

## 2. Fix topic grouping

- [x] 2.1 In `packages/ui/src/timeline/grouping.ts`, derive the slug in `changeTopicsMap` from the resolved
      change **node** via `changeNodeSlug`, so the map is keyed by plain slug for aggregated graphs too
- [x] 2.2 Update the outdated comment above `changeTopicsMap` that claims ids are always `change:${slug}`

## 3. Tests

- [x] 3.1 Widen `packages/ui/package.json`'s test glob to `src/**/__tests__/*.test.ts` — it currently only
      matches `src/timeline/__tests__/`, so a test file anywhere else silently never runs
- [x] 3.2 Add `src/__tests__/graphNodeId.test.ts`: `changeNodeSlug` returns the same slug for the
      non-aggregated (`change:<slug>`, no `source`) and aggregated (`change:<key>:<slug>` + `source`) form of
      the same change, and leaves an already-normalised `change:<slug>` that still carries `source` alone
- [x] 3.3 Add `changeTopicsMap` tests for aggregated nodes asserting the map is keyed by plain slug
- [x] 3.4 Add a `buildLanes` group-by-topic test over an aggregated graph asserting real topic lanes instead
      of a single `(no topic)` lane — the regression from issue #25
- [x] 3.5 Run `npm test`, `npm run build:ui` (the only command that type-checks `@spekjs/ui` — its tests run
      under `tsx`, which strips types without checking) and `npm run type-check`

## 4. Docs and verification

- [x] 4.1 Document `changeNodeSlug` in `packages/ui/README.md`. There is no helpers section today —
      `buildLanes` only appears inline in the usage example — so add a short one rather than leaving the
      new export undocumented
- [x] 4.2 Verify against a real repo with ≥2 worktrees. Done by driving the actual data path
      (`buildGraphDataAggregated` → `buildLanes`) over this repo with a temporary second worktree, rather
      than through the browser: 72 namespaced change nodes → 47 topic lanes, 10 changes in the no-topic
      lane (changes with no spec edge, plus the dangling-edge cases of #26). Before the fix this same
      path put all of them in the no-topic lane
