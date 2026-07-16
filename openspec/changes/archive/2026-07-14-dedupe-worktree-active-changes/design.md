## Context

`scanOpenSpecAggregated` (`packages/core/src/scanner.ts`) scans every worktree of a repo and unions their active changes with no dedup, tagging each with a `source: WorktreeSource`. `buildGraphDataAggregated` does the same independently, calling the lighter `buildGraphData(wt.path)` per worktree and namespacing node ids as `change:<worktreeKey>:<slug>` to avoid collisions between duplicate copies. Archived changes already dedupe by slug (main-priority, first-wins); active changes do not.

A fresh worktree created from `main` inherits every change directory that existed on `main` at fork time, not just the one it goes on to edit. So with N open changes and N worktrees, every worktree — and `main` — carries all N change directories, and today's union produces up to N × (worktrees + 1) entries for N logically distinct changes. Deduplicating them means electing, per slug, the copy that is actually being worked on.

The tempting signal — filesystem mtime — does not work. `git worktree add` writes every file in the new tree fresh, so a change directory a worktree merely inherited carries an mtime equal to that worktree's **creation time**, not any edit time. mtime therefore cannot distinguish "edited here" from "checked out here", which is exactly the distinction the election needs.

## Goals / Non-Goals

**Goals:**
- One entry per active change slug in both the Changes list/Overview and the Graph, chosen from whichever worktree is actually editing it — identified by whether that copy has **diverged** from what it inherited, not by checkout time.
- A single, shared election so the list and graph paths cannot disagree about which worktree "owns" a slug.
- Preserve existing structure and contracts: the shared helper, the graph-side filter point, the spec-delta layout, `ChangeInfo.source`, and the `change:<worktreeKey>:<slug>` node id (parsed by `packages/ui/src/SpecGraph.tsx`) all stay.

**Non-Goals:**
- Changing archived-change dedup (already correct: main-priority, first-wins) or the rule that spec nodes come from the main worktree.
- Changing any API/frontend contract or the graph node id format.
- Surfacing both copies in the UI when a slug genuinely diverges in 2+ worktrees at once (see Open Questions).

## Decisions

### 1. Election signal is git divergence, not mtime

For a given slug, the candidates are the copies that have **advanced past their merge-base**. A non-main worktree is a candidate when it **provably diverges** on `openspec/changes/<slug>/`:

- **Committed divergence:** the slug appears in `git diff --name-only <main.head>...<wt.head> -- openspec/changes/`. The **three-dot** form compares against the merge-base, so it counts only the worktree's *own* advances since the fork — a two-dot (endpoint) diff would also fire when *main* advances a slug the worktree merely inherited, wrongly electing the idle fork's stale copy. `WorktreeInfo.head` is already supplied by `git worktree list --porcelain`, so no ref resolution is needed; when `wt.head === main.head` the diff is skipped entirely.
- **Uncommitted divergence:** the slug appears in `git status --porcelain -- openspec/changes/` for that worktree (covers the mid-edit, not-yet-committed case).

**Key:** the comparison is against **main's `HEAD` tree, not main's working tree.** When `main` itself has an uncommitted edit to a slug, an idle fork's inherited copy equals main's `HEAD` version but not main's working tree — only comparing against `HEAD` correctly recognises the fork as a pure inherited copy and leaves the slug on `main`.

When no worktree diverges for a slug, it stays on `main`. There is no unconditional "non-main beats main" rule; instead **`main` competes on the same terms as every worktree**. When the contest is live (some worktree diverges on the slug) and `main` has itself advanced past that worktree's merge-base — the reverse three-dot `git diff <wt.head>...<main.head>`, or `main` has uncommitted edits there — `main` joins the candidate pool, and the mtime tiebreak among all candidates decides. `divergedSlugs` is symmetric, so `main`'s side is just `divergedSlugs(main.path, main.head, wt.head)` — the same helper with its arguments swapped, one extra git pair per genuinely-competing worktree. This keeps it a single rule (advanced-then-recency) with no `main` carve-out, and it prevents an idle, half-done fork from shadowing a finished copy on *either* side.

*Alternatives considered:*
- **worktree unconditionally beats `main`** (the first cut of this change) — rejected: it is the version *with* a special case. When `main` and a worktree both genuinely advance the same slug, it would always hide `main`'s copy even when `main` holds the finished one. Folding `main` into the same divergence-then-mtime contest removes the carve-out. (In practice #3 is narrow: the common "finished on `main`" path is a merge of the worktree's branch back, after which `merge-base(main, wt) == wt.head`, the worktree's three-dot diff is empty, and it drops out on its own.)
- **mtime as the primary signal** — rejected: `git worktree add` rewrites file mtimes to checkout time, so the most-recently-created worktree would win every slug it merely inherited, and an idle fork would permanently shadow `main`. mtime measures checkout time, not edit time.
- **"exclude copies bit-identical to main"** — tempting but wrong: it must compare against main's `HEAD`, not its working tree, or scenario 2 (main mid-edit) leaks the fork's copy through the filter. Divergence detection *is* the "compare against HEAD" check, so we adopt it directly.
- **latest-commit recency as the primary signal** — needs an extra `git log` per slug and, worse, ignores uncommitted edits, which are precisely the "currently active" signal we want.

### 2. mtime retained only as the tiebreak among candidates

When two or more candidates advance the same slug — two worktrees, or `main` and a worktree (a rare, genuine editing conflict) — the copy whose change directory has the most recently modified file (`changeDirMtime`, computed the same way `artifacts.ts` computes artifact recency) wins. The tiebreak pool includes `main` on the same footing as any worktree. Scoped to copies already proven to carry real edits, mtime here reflects real edit time; it is also the only signal that captures uncommitted in-progress edits, and it is already computed elsewhere — no new mechanism.

### 3. git command failure → treat the worktree as not diverging (main wins)

The aggregated path is only reached when `listWorktrees` returns ≥2 worktrees, which itself requires git — so "no git at all" cannot reach the election. Only a per-command failure of `git diff` / `git status` for a specific worktree remains; mirroring `git-cache.ts`'s resolve-empty-on-error, that worktree is treated as not diverging. Worst case renders main's committed baseline, never a random inherited snapshot — strictly better than the status quo's duplicate rows.

### 4. Shared election helper takes `{ wt, slugs }[]`

Divergence is computed **per worktree in a batch** (at most two git calls per non-main worktree covering all its slugs, not one call per slug), run in parallel with the existing per-worktree scans. The helper takes each worktree paired with its active slugs and returns a `Map<slug, WorktreeInfo>` of winners. Both `scanOpenSpecAggregated` and `buildGraphDataAggregated` call it. Because the helper needs only slugs (not full `ChangeInfo`), `buildGraphDataAggregated` derives them from its existing `buildGraphData(wt.path)` change nodes and no longer runs a full `scanOpenSpec` per worktree purely to obtain slugs — so the graph path's subprocess count can drop.

*Alternatives considered:*
- **two independent implementations** (duplicate priority+tiebreak in both functions) — rejected: risks the list and graph disagreeing about which worktree owns a slug.
- **have `buildGraphDataAggregated` call `scanOpenSpecAggregated`** and reverse-engineer winners from its deduped `ChangeInfo[]` — rejected: more roundabout than sharing the one helper both already call.

### 5. Archived changes untouched

The existing main-priority, first-wins dedup for archived changes stays exactly as is in both functions; only the active-change path changes.

## Risks / Trade-offs

- **[New git calls on the scan hot path]** → at most two batched calls per non-main worktree, same order of magnitude as the existing per-worktree `git log` in `getTimestamps`, run in parallel with the scans; skipped entirely when `wt.head === main.head`.
- **[git failure could surface main's older copy]** → only when the sole real work lives in a worktree whose git call failed — rare, and still better than today's duplicate rows.
- **[Tiebreak among 2+ simultaneously diverging copies is somewhat arbitrary]** → resolved by newest `changeDirMtime` and recorded in the spec; a rare genuine editing conflict where any choice involves a trade-off.

## Migration Plan

Pure logic change inside `@spekjs/core`, no data migration. No API shape changes (same `ChangeInfo`/`GraphNode` fields, same id format) — only which entries are present. Rewrite `pickActiveWinners` and add the divergence-detection helper, update `packages/core/src/aggregate.test.ts`, sync docstrings and `CLAUDE.md`, add `packages/core/CHANGELOG.md` and root `CHANGELOG.md` entries. Rollback restores these files. Ships as a normal patch/minor release of `@spekjs/core`; VS Code/IntelliJ pick it up on their next build against the workspace-resolved core.

## Open Questions

- When the same slug genuinely diverges in 2+ worktrees at once, should the UI surface both copies rather than silently electing one? Out of scope here; recorded only.
