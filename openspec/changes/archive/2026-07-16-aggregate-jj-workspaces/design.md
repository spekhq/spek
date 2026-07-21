## Context

v1.8.1 aggregates active changes across git worktrees and elects **one winner per slug** via a
git-history **divergence election** (`worktree-aggregation` spec → `pickActiveWinners` +
`divergence.ts`). The entire aggregation data flow is built on `WorktreeInfo[]`: `listWorktrees`
enumerates → `scanOpenSpecAggregated` / `buildGraphDataAggregated` scan by `wt.path`, name nodes by
`wt.key`, tag source by `toWorktreeSource`. The least-invasive way to add jj is to make jj workspaces
produce the **same `WorktreeInfo` shape** and converge at a single enumeration point.

## Goals / Non-Goals

- **Goals:** aggregate OpenSpec changes from jj workspaces; highlight the jj `@` change; independent
  jj toggle; graceful, byte-identical fallback when `jj` is unavailable; **reuse** v1.8.1's election
  rather than duplicating it.
- **Non-Goals:** changing git-worktree behaviour or its defaults; rewriting the scan/graph engine for
  jj; IntelliJ / Demo (unchanged). No new dedup mechanism for git worktrees — theirs is done.

## Key decision: the election dispatches by VCS

The election stays **one winner per slug**, but the *candidate/winner rule* is chosen by source:

- **git worktree → divergence election (unchanged).** `pickActiveWinners` over `listWorktrees`
  entries, exactly as v1.8.1.
- **jj workspace → content identity (new).** jj workspaces share one commit graph and each
  materialises the **whole trunk**, so a trunk change appears once per workspace with *identical
  content*. The right key is therefore **content**, not history: `changeContentFingerprint(dir, slug)`
  = sha1 over the change directory's (relative path + bytes). Identical fingerprint ⇒ drop the
  duplicate; divergent fingerprint (a workspace editing that change) ⇒ keep as a distinct entry
  flagged `conflictsWith` its base; brand-new slug ⇒ keep.

**Why they cannot share one mechanism (the hard invariant).** The divergence election runs
`git diff <base>...<head>` and `git status` keyed on a git commit. A jj `WorktreeInfo.head` is a jj
**change-id**, and jj workspaces are invisible to `git worktree list`. Feeding a jj workspace into
`pickActiveWinners` runs git with a non-git rev → error → the code treats "git failed" as "not
diverging" → the workspace is silently dropped, losing `isCurrent`/`conflictsWith`. So the two
strategies run over **disjoint inputs** and are unioned by slug afterward. This invariant is the
single most important thing to preserve and to test.

## Integration points (layered on v1.8.1, not replacing it)

- `scanOpenSpecAggregated`: split scans into `gitScans` (`vcs !== "jj"`) and jj workspaces. Run
  `pickActiveWinners(gitScans, main)` for git (unchanged path). Then run jj content-dedup, **seeding
  the baseline from `main`'s content** regardless of whether main won any slug in the git election
  (main is the trunk baseline).
- `buildGraphDataAggregated`: same split — `activeEntries` for the election must **exclude jj**
  (`vcs !== "jj"`); jj nodes are deduped by fingerprint in the node loop, skipping duplicates' edges
  so a spec's `historyCount` is not inflated. `change:<key>:<slug>` namespacing already prevents id
  collisions.
- **Pure-jj repo (no git backend):** `main` is itself a jj workspace; `gitScans` is empty, the git
  election is a no-op, and `main` is emitted through the jj path (which also seeds the baseline).

## Enumeration & `@` highlighting

- `listJjWorkspaces(dir)`: `jj workspace list -T <template>` → `WorktreeInfo[]` with `vcs: "jj"`,
  `default` first; error/non-jj → `[]` (same graceful contract as `listWorktrees`).
- `listWorkspaces(dir, { includeJj })`: merge git + jj, **path-dedup** the colocated main (git wins to
  keep the branch), main first. Single enumeration point for aggregation and the watcher.
- `jjCurrentChangeSlugs(dir)`: `jj diff --ignore-working-copy --name-only -r @` (read-only, no
  snapshot) → the slugs `@` is editing → `isCurrent`.

## Reuse

`jj-workspaces.ts`, `listWorkspaces`, `changeContentFingerprint`, the `WorktreeInfo.vcs` /
`ChangeInfo.isCurrent|conflictsWith` type additions, the jj + coexistence tests, and the UI markers /
`jjWorkspacePref` / VS Code setting are **proven** and preserved at tag `archive/jj-rebased`
(`2c366bd`). They are reused ~verbatim (`git show archive/jj-rebased:<path>`). Only the
`scanner.ts` integration is re-expressed in the VCS-dispatch shape above, and the specs are authored
clean (no "union / no content deduplication" language).

## Risks / trade-offs

- **Timestamps:** git worktree copies get mtime from `git-timestamp-cache`; jj-only changes fall back
  to reading file mtime. Unchanged from v1.8.1 for git.
- **realpath:** on macOS `/tmp`→`/private/var`, jj/git report canonical paths — tests must
  `fs.realpathSync` the repo root before comparing `path`s (already handled in the reused tests).
- **Cost:** fingerprints are computed **only when the repo actually has jj workspaces**; a git-only
  repo does zero extra I/O.
