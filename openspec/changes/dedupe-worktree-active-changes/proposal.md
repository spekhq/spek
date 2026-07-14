## Why

When several git worktrees each work through a different in-progress OpenSpec change that was committed to `main` before the worktrees were created, every worktree inherits a copy of every open change directory (not just the one it is actively editing). Cross-worktree aggregation currently unions active changes across all worktrees with **no deduplication** — documented as intentional in `worktree-aggregation`'s "Aggregate active changes across worktrees" requirement and mirrored in `graph-view`'s "Aggregated change nodes from worktrees" requirement. With 5 open changes and 5 worktrees, this turns a 5-change repo into a wall of duplicate entries in both the Changes list and the dependency Graph, making it hard to watch real progress.

Deduplicating requires an **election**: for each slug, which worktree's copy is the one actually being worked on? The signal that answers this must survive `git worktree add`, which rewrites every file in the new tree — so filesystem mtime reflects **checkout time**, not edit time, and cannot tell an inherited-but-untouched copy apart from the copy someone is editing. The signal that does survive is **git divergence**: the copy that has advanced its change directory (committed or uncommitted) beyond the main worktree's `HEAD` is the one doing the work.

## What Changes

- Deduplicate active (non-archived) changes across worktrees by slug, keeping exactly one entry per slug instead of one per worktree that happens to contain it.
- Election signal is **git divergence**, not filesystem mtime: for a given slug, a non-main worktree is a **candidate** only when it has provably diverged from the main worktree's `HEAD` for that change — its `HEAD` advances `openspec/changes/<slug>/` beyond main's `HEAD`, OR it has uncommitted modifications under that path. A worktree that merely inherited the directory untouched is never a candidate, regardless of mtime.
- When no non-main worktree diverges for a slug, the main worktree keeps it. There is no unconditional "non-main beats main" rule — divergence subsumes it, so an idle fork can never shadow work happening on `main` itself.
- Filesystem mtime is retained only as the **tiebreak among two or more genuinely diverging copies** of the same slug — the one case where the files carry real edit times.
- When a git command fails for a worktree, that worktree is treated as not diverging (main wins), mirroring `git-cache.ts`'s resolve-empty-on-error posture.
- Apply the same election to the aggregated dependency Graph: emit one change node per active slug (from its winning worktree) instead of one node per worktree per slug. This also fixes inflated spec fan-in counts (`historyCount`), previously double-counted from duplicate edges.
- The winning-worktree-per-slug decision is implemented once and reused by both the Changes-list aggregation and the Graph aggregation, so the two cannot drift apart. The shared helper takes `{ wt, slugs }[]`, which also lets the graph path stop running a full `scanOpenSpec` per worktree purely to obtain slugs.
- Archived-change dedup behaviour (main-worktree-priority, first-wins) is unchanged; only active/in-progress changes are affected.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `worktree-aggregation`: "Aggregate active changes across worktrees" changes from union-without-dedup to dedup-by-slug elected by git divergence (candidate only when diverged from main's `HEAD`; main keeps the slug when nothing diverges; mtime tiebreak among diverging copies; git-failure treated as not diverging).
- `graph-view`: "Aggregated change nodes from worktrees" changes from one node per worktree per active slug to one node per active slug from the winning worktree, using the same divergence election so list and graph agree.

## Impact

- `packages/core/src/scanner.ts` — `scanOpenSpecAggregated` and `buildGraphDataAggregated`; a shared slug→winning-worktree election helper taking `{ wt, slugs }[]`, plus a divergence-detection helper built on `WorktreeInfo.head` / `git diff --name-only` / `git status --porcelain` (reusing the existing `execFile` + resolve-empty-on-error style).
- `packages/core/src/aggregate.test.ts` — new/updated cases using real `git worktree add` in natural creation order (no `fs.utimesSync`), asserting the winning `source` **and** `taskStats`; the old "same active slug in two worktrees kept separately" test is superseded by dedup behaviour.
- Docs: `CLAUDE.md` (`scanOpenSpecAggregated` is no longer a non-deduplicating union), `packages/core/CHANGELOG.md`, root `CHANGELOG.md`.
- No API or frontend contract changes: `ChangeInfo.source` and the graph node id format (`change:<worktreeKey>:<slug>`) are unchanged — only which entries survive dedup changes.
