## Context

`scanOpenSpecAggregated` (`packages/core/src/scanner.ts`) scans every worktree of a repo and unions their active changes with no dedup, tagging each with a `source: WorktreeSource`. `buildGraphDataAggregated` does the same independently, by calling the lighter `buildGraphData(wt.path)` per worktree (which does not compute `ChangeInfo`/timestamps) and namespacing node ids as `change:<worktreeKey>:<slug>` specifically to avoid collisions between duplicate copies. Archived changes already dedupe by slug, main-worktree-priority, first-wins — active changes don't get this treatment today.

A fresh worktree created from `main` inherits every change directory that existed on `main` at fork time, not just the one it goes on to edit. So with N open changes and N worktrees (one per change), every worktree — and `main` — carries all N change directories, and today's union produces up to N × (worktrees + 1) list entries for N logically distinct changes.

## Goals / Non-Goals

**Goals:**
- One entry per active change slug in both the Changes list/Overview and the Graph, chosen from whichever worktree is actually editing it.
- Reuse existing per-change timestamp data (`ChangeInfo.timestamp`/`date`, `compareChangesByTimestamp`) for tie-breaking instead of introducing a new recency signal.
- Single, shared election logic so the list and graph paths can't disagree about which worktree "owns" a slug.

**Non-Goals:**
- Changing archived-change dedup (already correct: main-priority, first-wins).
- Changing the graph node id format (`change:<worktreeKey>:<slug>`) or any API/frontend contract — `packages/ui/src/SpecGraph.tsx` parses that id format and must keep working unmodified.
- Perfect election when a change has genuinely never been touched by any worktree (no worktree has a newer commit under its path than `main`) — in that case which worktree "wins" is arbitrary and inconsequential, since nothing distinguishes the copies yet.

## Decisions

**Priority rule: non-main beats main; among non-main ties, newest change-directory mtime wins.**
A worktree that has started editing a change touches files under that change's directory, advancing their filesystem mtime relative to the untouched, inherited copies elsewhere. This means the tiebreak isn't just a fallback for a rare edge case — it's the actual mechanism that identifies "the worktree currently doing the work" without needing an explicit change→worktree assignment. `main` is excluded from winning whenever any worktree also has the slug, since `main` is never the active worker once a change has been forked into a worktree.

**Correction from the original proposal**: the proposal and initial draft of this design assumed `ChangeInfo.timestamp` (from `getTimestamps`/`buildChangeTimestamps` in `git-cache.ts`) could serve as the recency signal. It can't — that function deliberately keeps the *earliest* commit touching a change's path (see its comment: `git log 最新在前，持續覆寫 → 最後留下最早 commit`), as a creation-date signal for list sorting. Since an inherited, untouched copy of a change shares the same earliest commit as `main`'s copy across every worktree, `timestamp` is identical for all of them and cannot distinguish "actively edited here" from "just inherited." The tiebreak instead uses the change directory's most-recent file mtime, computed the same way `artifacts.ts`'s `discoverArtifacts` already computes recency for artifact ordering within a change (max mtime across the directory's files) — a precedented, dependency-free signal, computed with a plain `fs.stat` walk rather than a new git query.

Alternative considered: explicit slug→worktree pinning (e.g. a config file or convention). Rejected — adds a manual bookkeeping burden and a second source of truth that can drift from where the work actually happens; mtime is already computed elsewhere in the codebase for the same purpose and free.

Alternative considered: query the latest (not earliest) git commit per worktree per slug via a dedicated `git log -1 -- <path>` call. Rejected in favor of mtime — it would require a new git subprocess pattern distinct from the existing cache, and wouldn't see uncommitted edits, which are exactly the "currently active" signal we want (a worktree mid-edit, not yet committed, should still win).

**Single shared election helper, called from both `scanOpenSpecAggregated` and `buildGraphDataAggregated`.**
Add a function that takes the per-worktree `ChangeInfo[]` (active only) plus which worktree is main, and returns a `Map<slug, WorktreeInfo>` of winners. `scanOpenSpecAggregated` already computes `scans: { wt, scan }[]` via `scanOpenSpec` per worktree — feed that directly in. `buildGraphDataAggregated` currently only calls `buildGraphData` (no `ChangeInfo`/timestamps); it will additionally call `scanOpenSpec` per worktree (same cost as the list path) purely to run the same election, then filter which worktree's nodes/edges it emits per slug using the winner map.

Alternative considered: keep two independent implementations (duplicate the priority+tiebreak logic in both functions). Rejected per proposal — risks the two views disagreeing about which worktree "wins" a slug, which would be a confusing regression in its own right.

Alternative considered: have `buildGraphDataAggregated` call `scanOpenSpecAggregated` and derive winners from its output. Rejected — `scanOpenSpecAggregated`'s return shape is the deduped `ChangeInfo[]` list, not the winner map itself, and reverse-engineering the map from it (matching by slug+source) is more roundabout than sharing the one function both call.

**Archived changes untouched.** The existing main-priority, first-wins dedup for archived changes stays exactly as is in both functions; only the active-change path changes.

## Risks / Trade-offs

- [Extra `scanOpenSpec` calls in `buildGraphDataAggregated`] → Acceptable: worktree counts are small (single digits) and this isn't a hot path (graph is fetched on navigation, not polled tightly).
- [A change untouched by any worktree ties main against itself trivially] → Not a real risk: with only one candidate (main's copy, since no worktree diverged), there's nothing to dedupe; the existing single-entry behavior is preserved.
- [Behavior change breaks the existing test asserting duplicates are kept] → Expected and intentional; `aggregate.test.ts`'s "same active slug in two worktrees kept separately" test is being updated as part of this change to assert the new dedup instead.

## Migration Plan

Pure logic change inside `@spekjs/core`, no data migration. No API shape changes (same `ChangeInfo`/`GraphNode` fields, same id format) — only which entries are present. Ships as a normal patch/minor release of `@spekjs/core`; VS Code/IntelliJ pick it up on their next build against the workspace-resolved core.
