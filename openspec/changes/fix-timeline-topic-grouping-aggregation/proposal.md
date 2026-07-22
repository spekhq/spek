## Why

With worktree aggregation on (the default), the timeline's "group by topic" silently degrades: every
change lands in the `(no topic)` lane. Aggregated graphs name change nodes `change:<worktreeKey>:<slug>`,
and the package's two consumers of that id disagree — `SpecGraph` strips the worktree key, the timeline's
`changeTopicsMap` does not. The map ends up keyed by `<worktreeKey>:<slug>` while `buildLanes` looks up
by `slug`, so nothing ever matches. The chart still renders, so it reads as "this repo has no spec
relationships" rather than as a bug (issue #25, reported by a downstream consumer of `buildLanes`).

## What Changes

- Interpret aggregated change node ids consistently across `@spekjs/ui`: extract one shared helper that
  turns a graph change node into its slug, and use it in both `SpecGraph` and the timeline's grouping.
  The helper resolves the slug from the node's `source` (present only on aggregated graphs), not by
  guessing at colons in the id. It is exported, so hosts stop re-implementing the parsing.
- `changeTopicsMap` keys its result by plain slug for aggregated and non-aggregated graphs alike, so
  `buildLanes` finds topics in both.
- Add regression tests covering aggregated node ids, which today have no coverage at all — the failure
  is invisible because the chart renders either way.

Not in scope: making lanes worktree-aware (the same slug in two worktrees as separate lanes). Today
`buildLanes` keys purely by slug; stripping is the behaviour-preserving fix.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `timeline-view`: the "group by spec topic" requirement gains the aggregated-repo case — grouping SHALL
  behave identically whether the graph came from a single worktree or from aggregation.
- `ui-package`: adds a requirement that the package interprets graph change node ids in one place, so its
  components cannot drift apart in how they map a node back to a slug.

## Impact

- `packages/ui/src/timeline/grouping.ts` — `changeTopicsMap` slug resolution
- `packages/ui/src/SpecGraph.tsx` — switches to the shared helper (behaviour unchanged)
- `packages/ui/src/index.ts` — the helper joins the public API
- `packages/ui/src/timeline/__tests__/grouping.test.ts` — regression tests for aggregated ids
- `@spekjs/ui` — user-visible behaviour change for registry consumers, and a new public export. The
  CHANGELOG entry and version bump are **not** part of this change; they happen at release time
- Both hosts that render `TimelinePage` are fixed by the same change, with no host-side edit: spek web
  (`aggregate` defaults on) and the VS Code webview (`spek.aggregateWorktrees` defaults to true)
- Unaffected: the Demo (built with `buildGraphData`, plain ids) and IntelliJ (its Kotlin core has no
  aggregation, so it never namespaces a node id)
- No change to `@spekjs/core`: the node-id format stays as specified. The helper deliberately lives in
  `@spekjs/ui`, which only type-imports core — a runtime import would pull server-only modules into the
  browser bundle
