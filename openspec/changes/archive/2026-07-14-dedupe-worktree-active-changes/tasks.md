## 1. Divergence detection helper (TDD)

- [x] 1.1 Add a failing test: given two real git worktrees (`git worktree add`, no `fs.utimesSync`), the helper reports a slug as diverged when the linked worktree has committed progress under `openspec/changes/<slug>/`
- [x] 1.2 Add a failing test: the helper reports a slug as diverged when the linked worktree has uncommitted modifications under that path, and as NOT diverged when it merely inherited the directory untouched
- [x] 1.3 Add a failing test: when the git command errors for a worktree, the helper reports no divergence for it (resolve-empty-on-error, mirroring `git-cache.ts`)
- [x] 1.4 Implement the helper: per non-main worktree, three-dot `git diff --name-only <main.head>...<wt.head> -- openspec/changes/` (merge-base–relative, so only the worktree's own advances count; skipped when `wt.head === main.head`) unioned with `git status --porcelain -- openspec/changes/`, parsed into the set of diverged slugs; compare against main's `HEAD`, not its working tree; run the two git calls per worktree in parallel with the existing scans
- [x] 1.5 Run `npm run test -w @spekjs/core` — 1.1–1.3 now pass

## 2. Divergence-based election in `pickActiveWinners` (TDD)

- [x] 2.1 Add a failing test: worktree `wa` edits `change-a` to 3 of 4, then `wb` is created inheriting it untouched → winner is `wa`, `taskStats` 3 of 4 (no `utimesSync`)
- [x] 2.2 Add a failing test: `main` has uncommitted edits advancing `change-x` to 4 of 4, then `wb` is created inheriting it untouched → winner is `main` (`isMain: true`), `taskStats` 4 of 4
- [x] 2.3 Add a failing test: two non-main worktrees both diverge on the same slug → most-recently-modified (`changeDirMtime`) wins the tiebreak
- [x] 2.4 Add a failing test: git divergence check failing for a non-main worktree that carries a slug also on main → main wins that slug
- [x] 2.5 Rewrite `pickActiveWinners` to take `{ wt, slugs }[]`, elect via divergence (candidate only if diverged; else main keeps the slug), `changeDirMtime` tiebreak among diverging copies; delete the unconditional "non-main beats main" rule
- [x] 2.6 Update `scanOpenSpecAggregated` to pass `{ wt, slugs }` into the new signature
- [x] 2.7 Run `npm run test -w @spekjs/core` — 2.1–2.4 now pass

## 3. Graph path: drop redundant scans (concern #4)

- [x] 3.1 Add a failing/updated test: `buildGraphDataAggregated` elects the same winners as the list path when a fork is inherited-but-untouched (node namespaced by main, not the idle fork); reuse the existing `historyCount` dedup assertion
- [x] 3.2 Change `buildGraphDataAggregated` to derive each worktree's active slugs from its `buildGraphData(wt.path)` change nodes and feed `{ wt, slugs }` into `pickActiveWinners`, removing the per-worktree `scanOpenSpec` calls made only to obtain slugs
- [x] 3.3 Run `npm run test -w @spekjs/core` — graph tests pass

## 4. Close the test gaps

- [x] 4.1 Remove the `wtB 先分岔，main-change 之後才加…` fixture-ordering workaround in `aggregate.test.ts`; confirm the divergence election keeps the two changes distinct in natural creation order (the `each change carries its own worktree's defaultSchema` case stays green)
- [x] 4.2 Audit `aggregate.test.ts`: every worktree-election assertion checks **both** `source` and `taskStats`, and the realistic-order cases from tasks 2.1–2.2 use no `fs.utimesSync`
- [x] 4.3 Run the full `npm run test -w @spekjs/core` suite and `npm run type-check` — green (note the pre-existing macOS-flaky `listWorktrees` case)

## 5. Docs and changelogs (concerns #3, #5)

- [x] 5.1 Fix the orphaned/stale docstring on `pickActiveWinners` and the "active 不去重" docstring on `buildGraphDataAggregated` / `scanOpenSpecAggregated` to describe divergence-based dedup
- [x] 5.2 Update the `scanOpenSpecAggregated` description in `CLAUDE.md` (no longer a non-deduplicating union)
- [x] 5.3 Add an entry to `packages/core/CHANGELOG.md` (API-consumer framing) and to root `CHANGELOG.md` (Web / VS Code / IntelliJ user framing)

## 6. Verify end-to-end

- [x] 6.1 Run a repro of both scenarios against this branch and confirm `[1] wa / 3-of-4` and `[2] main / 4-of-4`
