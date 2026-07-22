## Context

`buildGraphDataAggregated` rewrites every aggregated change node to `change:<worktreeKey>:<slug>` and
attaches a `source: WorktreeSource` to it (`packages/core/src/scanner.ts`). Non-aggregated graphs — and
the aggregated path when the repo has a single worktree, which falls back to `buildGraphData` — emit
plain `change:<slug>` nodes with no `source`.

`@spekjs/ui` has two consumers of that id and they disagree:

| | how it maps a node id to a slug |
|---|---|
| `SpecGraph.tsx:212-215` | branches on `d.source`: slices `change:${d.source.key}:` when aggregated, `change:` otherwise |
| `timeline/grouping.ts:49` | `stripPrefix(changeId, "change:")` only |

`buildLanes` then looks the map up with `topicsBySlug.get(c.slug)`, where `c.slug` is the plain slug from
`ChangeInfo`. Under aggregation the map keys carry the worktree key, so every lookup misses and every
change falls into the `""` (no-topic) lane. Nothing throws and the chart still draws — the failure is
only visible as "this repo apparently has no spec relationships" (issue #25).

The existing tests in `packages/ui/src/timeline/__tests__/grouping.test.ts` only use plain
`change:<slug>` fixtures, so nothing catches it.

## Goals / Non-Goals

**Goals:**

- Topic grouping works identically for aggregated and non-aggregated graph data.
- One place in `@spekjs/ui` owns "graph change node → slug", so the two consumers cannot drift again.
- Regression coverage for aggregated ids.

**Non-Goals:**

- Worktree-aware lanes (the same slug from two worktrees as separate lanes). `buildLanes` keys purely by
  slug today; that would be a different design, and this change is behaviour-preserving.
- Changing the node id format in `@spekjs/core`. The format is specified (`graph-view`, `openspec-api`)
  and other consumers depend on it.
- Threading the worktree key through `LaneItem` / the tooltip.

## Decisions

**The helper lives in `@spekjs/ui`, not in `@spekjs/core`.**
Core owns the id format, so core is the intuitive home — but `@spekjs/ui` declares `@spekjs/core` as a
peer dependency and imports it for **types only** (`import type`). A runtime import would drag core's
server-only modules (`node:fs`, `cross-spawn`) into every browser bundle that renders the timeline. The
repo already has this constraint written down for `@spekjs/core/headings`. If core ever wants to expose
it, it needs a browser-safe subpath first; that is not this change.

**Resolve the slug from `node.source`, not by splitting on `:`.**
The id alone is ambiguous: nothing distinguishes `change:<key>:<slug>` from a `change:<slug>` whose slug
contains a colon, because the key is present only on aggregated nodes. `source` is the authoritative
signal — `buildGraphDataAggregated` sets it on exactly the nodes whose ids it namespaced
(`scanner.ts:772-774`; there is no path that renames an id without attaching it). So the helper takes the
node, not a bare string: strip `change:`, then strip `${source.key}:` when `source` is present **and the
remainder actually starts with it**. Alternative considered — `id.split(":").pop()` — rejected: it would
"work" on non-aggregated ids by accident, hiding exactly the class of bug this change exists to close.

That `startsWith` guard is load-bearing, not defensive noise. A downstream host that has already
normalised ids to `change:<slug>` while keeping `source` (spekterm's workaround) would otherwise have the
first `key.length + 1` characters eaten off its slugs.

**`changeTopicsMap` keys by plain slug (unchanged contract for existing callers).**
It already resolves each edge endpoint to its node before classifying, so the node — and therefore
`source` — is in hand at the point where the slug is derived. No signature change; callers that already
looked up by `ChangeInfo.slug` (`buildLanes`, and downstream consumers such as spekterm) start matching
instead of silently missing. This is a fix to a documented-by-implication contract, not a new one.

**`SpecGraph` switches to the helper without behaviour change.**
It keeps passing `d.source.key` as the callback's second argument; only the slug derivation moves into
the helper.

**The helper is exported from the package entry point.**
The bug was found by a host that consumes `buildLanes` with an aggregated graph and had to normalise node
ids itself. Keeping the helper private would fix the timeline but leave every such host re-implementing
the parsing this change exists to centralise. It is a two-line, dependency-free addition to the public
surface.

## Risks / Trade-offs

- **A downstream consumer already worked around this by normalising node ids before calling `buildLanes`
  (spekterm does).** After the fix their normalisation becomes a no-op rather than a conflict — stripping
  an already-stripped id leaves it alone — so no breakage, but the release note should say so explicitly
  so they can drop the workaround.
- **Behaviour change in a published package.** Lanes that were empty start filling. That is the point of
  the fix, but it is user-visible for `@spekjs/ui` consumers, and the new export makes the release
  additive rather than a patch — both facts for whoever cuts the release to record then.
- **Dangling spec edges keep some changes in the no-topic lane, and this change does not address that.**
  `buildGraphData` emits an edge for every delta-spec directory of every change, but creates spec nodes
  only for topics that exist under `openspec/specs/` — so a change introducing a new capability has an
  edge pointing at a node that isn't there, and `changeTopicsMap` drops it (2 of 164 edges in this repo
  today). Aggregation makes it worse: spec nodes come from the main worktree only, so a topic living only
  in a feature worktree also dangles. Pre-existing, orthogonal, and deliberately out of scope — tracked
  as issue #26 — but the spec must not claim the no-topic lane means "no spec edge", because it doesn't.
- **The helper is only as good as `source`.** If a future aggregation path namespaces an id without
  setting `source`, the helper silently returns the namespaced string — the same class of bug in a new
  place. Mitigated by keeping the derivation in one function and asserting the aggregated case in tests.
