# Aggregate jj workspaces alongside git worktrees

## Why

Teams increasingly run parallel work in **colocated git + Jujutsu (jj)** repos, placing
in-progress work in *jj workspaces* (`jj workspace add`). jj workspaces are **invisible to
`git worktree list`**, so spek silently misses every OpenSpec change authored in them.

spek v1.8.1 already aggregates and **deduplicates** active changes across git worktrees via a
git-history **divergence election** (`worktree-aggregation` spec → `pickActiveWinners` /
`divergence.ts`): for each slug, the worktree that has advanced the change past the main
worktree's `HEAD` wins, with filesystem mtime only as a tiebreak. This change **extends that
same election** to cover jj workspaces — it does not replace or parallel it.

The catch is that jj cannot use the git-history signal:

- jj workspaces don't appear in `git worktree list`, and
- a jj working copy's identity is a **jj change-id, not a git commit** — there is no per-workspace
  git `HEAD` to run a three-dot diff against.

And jj *duplicates differently*: every workspace shares one commit graph and materialises the
**entire trunk**, so one in-progress trunk change appears **once per workspace** with identical
content (measured: 4 workspaces → the same change 4 times). That is a *content-identity* problem,
not a *history-divergence* problem — so jj needs a sibling election strategy, not the git one.

jj also offers a signal git lacks: the working-copy commit `@` always points at "the change the
user is editing right now" — a free, precise "currently editing" indicator for a read-only viewer.

## What Changes

The active-change election becomes **VCS-dispatched**: one winner per slug, chosen by the
strategy that fits the source.

- **Enumerate all working copies, not just git worktrees.** Add `listJjWorkspaces(dir)` and a
  unifying `listWorkspaces(dir, { includeJj })` that merges git worktrees + jj workspaces,
  path-deduplicating the colocated main directory (it is both the git main worktree and the jj
  `default` workspace).
- **git worktrees** keep the existing **divergence election** — unchanged.
- **jj workspaces** are deduplicated by **content identity** (a fingerprint over the change
  directory's file paths + contents): byte-identical trunk copies collapse to one; a copy whose
  content diverges (a workspace actively editing that change) is kept as a distinct entry flagged
  `conflictsWith` the base it diverges from.
- **`@` highlighting.** A change that a jj workspace's `@` is editing is marked `isCurrent`, via a
  side-effect-free `jj diff --ignore-working-copy -r @`.
- **Disjoint paths (hard invariant).** jj workspaces are **never** fed into the git divergence
  election (`pickActiveWinners`) — their `head` is a jj change-id, so git would error and silently
  drop them. The two strategies operate over disjoint inputs and are unioned by slug afterward.
- **Pure-jj repos.** When a repo has no git backing (main is itself a jj workspace), the whole
  aggregation runs through the jj content-identity path.
- **Graceful degradation.** When `jj` is absent or the repo is not a jj repo, behaviour is
  byte-for-byte identical to v1.8.1. `jj` is never required.
- **Surfaces.** An independent inclusion toggle (Web `jj` query param + "Include jj workspaces"
  checkbox; VS Code setting `spek.aggregateJjWorkspaces`, default on), plus jj source /
  currently-editing / conflict indicators in the Changes list, the dependency graph, and the VS
  Code sidebar. IntelliJ and Demo are unchanged.

## Impact

- **Specs:** MODIFY `worktree-aggregation` (generalise enumeration + name the VCS-dispatched
  election and the jj content-identity strategy); add capability `jj-workspace-aggregation`
  (the jj discovery, fingerprint dedup, `isCurrent`/`conflictsWith`, toggle) that references it;
  touch `graph-view`, `live-reload`, `openspec-api`, `vscode-sidebar` for the surfaces.
- **Code:** `@spekjs/core` — new `jj-workspaces.ts`, `listWorkspaces` in `worktrees.ts`,
  `changeContentFingerprint`, VCS-dispatch in `scanOpenSpecAggregated` / `buildGraphDataAggregated`
  layered on 1.8.1's `pickActiveWinners`; `WorktreeInfo.vcs`, `ChangeInfo.isCurrent|conflictsWith`.
  `@spekjs/web` server params + adapters + UI. VS Code setting + tree markers.
- **Reuse:** proven, already-tested building blocks are preserved at git tag `archive/jj-rebased`
  and reused ~verbatim; only the scanner integration and the specs are re-designed clean.
- **No impact:** git-worktree behaviour, IntelliJ plugin, Demo, and non-jj repos.
