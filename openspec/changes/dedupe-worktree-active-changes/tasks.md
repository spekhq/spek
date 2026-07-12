## 1. Failing tests for active-change dedup (list)

- [x] 1.1 In `packages/core/src/aggregate.test.ts`, update the existing "same active slug in two worktrees kept separately" test: rename it to reflect newest-mtime-wins, use `fs.utimesSync` on worktree B's change file to give it a deterministically later mtime than worktree A's, so the test can assert a single surviving entry sourced from worktree B without relying on wall-clock delays. Run it and confirm it fails against current behavior.
- [x] 1.2 Add a test: main and one worktree both have active change `add-foo` → aggregated list has exactly one `add-foo` entry, `source` points to the worktree (not main). Confirm it fails.
- [x] 1.3 Add a test: an active change exists only on main, no worktree has it → aggregated list still has exactly one entry, `source` points to main (regression guard, should already pass).

## 2. Shared election helper + list-side wiring

- [x] 2.1 In `packages/core/src/scanner.ts`, add a function that takes the per-worktree scan results (`{ wt, scan }[]`) plus the main worktree, and returns a `Map<slug, WorktreeInfo>` of winners for active slugs: non-main beats main; among non-main candidates, the copy whose change directory has the most recently modified file (mtime, computed the same way `artifacts.ts` computes recency) wins.
- [x] 2.2 Rewrite the active-changes section of `scanOpenSpecAggregated` to build the result from the winners map (one `ChangeInfo` per slug, tagged with its winning worktree's `source`) instead of the current unconditional union push.
- [x] 2.3 Run `npm run test -w @spekjs/core` and confirm the tests from Task 1 now pass, and the pre-existing archived-dedup and single-worktree tests still pass.

## 3. Failing tests for graph dedup

- [x] 3.1 In `packages/core/src/aggregate.test.ts`, add a test: main and one worktree both have active change `add-foo` with a delta spec → `buildGraphDataAggregated` produces exactly one `change:...:add-foo` node, namespaced by the worktree's key, not main's. Confirm it fails.
- [x] 3.2 Add a test: same setup → exactly one edge from the change node to the spec node, and the spec node's `historyCount` is 1, not 2. Confirm it fails.
- [x] 3.3 Confirm the existing "namespaces change node ids by worktree" test (distinct slugs, no collision) still passes unmodified — it's a regression guard for the non-colliding case.

## 4. Graph-side wiring

- [x] 4.1 In `buildGraphDataAggregated`, call `scanOpenSpec` per worktree (alongside the existing `buildGraphData` per worktree) to obtain `ChangeInfo`/timestamps, and run the same election helper from Task 2.1 to get the slug→winning-worktree map.
- [x] 4.2 When iterating each worktree's graph nodes/edges, skip active-status change nodes (and their edges) whose worktree is not the slug's winner; archived-status handling is unchanged.
- [x] 4.3 Recompute spec `historyCount` from the deduplicated edge set (existing logic already does this from `edges`, so verify no separate fix is needed once duplicate edges are gone).
- [x] 4.4 Run `npm run test -w @spekjs/core` and confirm the tests from Task 3 now pass.

## 5. Verification

- [x] 5.1 Run `npm run type-check` and the full `npm run test -w @spekjs/core` suite; all green.
- [ ] 5.2 Manually verify against a repo shaped like David's (multiple open changes on main, one worktree per change) that the Changes list and Graph each show one entry per change, sourced from the worktree doing the work.
