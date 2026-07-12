## Why

When several git worktrees each work through a different in-progress OpenSpec change that was committed to `main` before the worktrees were created, every worktree inherits a copy of every open change directory (not just the one it's actively editing). Cross-worktree aggregation currently unions active changes across all worktrees with **no deduplication** — this is documented as intentional in `worktree-aggregation`'s "Aggregate active changes across worktrees" requirement and mirrored in `graph-view`'s "Aggregated change nodes from worktrees" requirement. With 5 open changes and 5 worktrees, this turns a 5-change repo into a wall of duplicate entries in both the Changes list and the dependency Graph, making it hard to watch real progress. The worktree actively editing a change is the interesting copy; the inherited, untouched copy (in `main` or any other worktree) is noise that should be shadowed.

## What Changes

- Deduplicate active (non-archived) changes across worktrees by slug, keeping exactly one entry per slug instead of one per worktree that happens to contain it.
- Priority rule: a non-main worktree's copy of a change always shadows `main`'s copy of the same slug. If the same slug is present in more than one non-main worktree (e.g. several worktrees forked before any of them started editing), the copy with the most recently modified change directory (by filesystem mtime) wins — reusing the same recency pattern `artifacts.ts` already uses for artifact ordering, not a new mechanism.
- Apply the same dedup to the aggregated dependency Graph: emit one change node per active slug (from its winning worktree) instead of one node per worktree per slug. This also fixes inflated spec fan-in counts (`historyCount`), which were previously double-counted from duplicate edges.
- Archived-change dedup behavior (main-worktree-priority, first-wins) is unchanged in both the Changes list and the Graph — only active/in-progress changes are affected by this change.
- The winning-worktree-per-slug decision is implemented once and reused by both the Changes-list aggregation and the Graph aggregation, so the two do not drift apart.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `worktree-aggregation`: "Aggregate active changes across worktrees" changes from union-without-dedup to dedup-by-slug with worktree-over-main priority and most-recent-timestamp tiebreak.
- `graph-view`: "Aggregated change nodes from worktrees" changes from one node per worktree per active slug to one node per active slug (from the winning worktree), matching the same priority rule.

## Impact

- `packages/core/src/scanner.ts` — `scanOpenSpecAggregated` and `buildGraphDataAggregated`; introduces a shared slug→winning-worktree election helper.
- `packages/core/src/aggregate.test.ts` — new/updated cases for active-change dedup and graph node/edge dedup; the existing "same active slug in two worktrees kept separately" test is superseded by dedup behavior.
- No API or frontend contract changes: `ChangeInfo.source` and graph node id format (`change:<worktreeKey>:<slug>`) are unchanged, only which entries survive dedup changes.
