## ADDED Requirements

### Requirement: Enumerate working copies including jj workspaces

The `@spekjs/core` package SHALL provide an async function `listWorkspaces(dir, options)` that returns
every working copy of the repository containing `dir` as a single `WorktreeInfo[]`, merging git
worktrees (`listWorktrees`) with jj workspaces (`listJjWorkspaces`, per the `jj-workspace-aggregation`
capability). Entries SHALL be deduplicated by `key` (absolute-path hash) so a colocated main directory
— which is simultaneously the git main worktree and the jj `default` workspace — appears exactly once,
keeping the git entry so its branch is preserved. The main entry SHALL be ordered first. Inclusion of
jj workspaces SHALL be controlled by `options.includeJj` (default true); when false, only git worktrees
are returned and results are identical to git-worktree-only aggregation. Aggregated scanning and the
live-reload watcher SHALL enumerate through `listWorkspaces` so both agree on the working-copy set.

#### Scenario: Colocated main directory counted once

- **WHEN** `listWorkspaces(dir)` is called on a colocated git+jj repo whose main directory is both the
  git main worktree and the jj `default` workspace
- **THEN** the main directory appears exactly one entry, ordered first, with `vcs: "git"` (git wins to
  preserve the branch)

#### Scenario: jj inclusion disabled

- **WHEN** `listWorkspaces(dir, { includeJj: false })` is called
- **THEN** only git worktrees are returned and the result equals git-worktree-only enumeration

### Requirement: Active-change election dispatches by version-control system

The single "one winner per active change slug" election SHALL choose the winner using the strategy that
fits each working copy's version-control system, over **disjoint** input sets that are unioned by slug:

- **git worktrees** SHALL be resolved by the git-history divergence election defined in "Aggregate
  active changes across worktrees" (candidates that have advanced past merge-base; mtime tiebreak),
  unchanged.
- **jj workspaces** SHALL be resolved by the content-identity deduplication defined in the
  `jj-workspace-aggregation` capability (identical trunk copies collapse to one; divergent copies are
  kept and flagged `conflictsWith`).

jj workspaces SHALL NEVER be passed into the git divergence election: they are invisible to
`git worktree list` and a jj working copy's `head` is a jj change-id, not a git commit, so the
history-based signal does not exist for them and running it would erroneously discard them. When a repo
has no jj workspaces, behaviour SHALL be byte-for-byte identical to git-worktree-only aggregation.

#### Scenario: git election and jj dedup coexist without interfering

- **WHEN** aggregation runs on a colocated repo that has a git worktree diverging on slug `git-change`
  and a jj workspace carrying a jj-only change `jj-only`
- **THEN** `git-change` appears once, resolved by the divergence election with `source.vcs === "git"`
- **AND** `jj-only` appears once via the content-identity path with `source.vcs === "jj"`
- **AND** the jj workspace is not fed into the git divergence election

#### Scenario: No jj workspaces means unchanged behaviour

- **WHEN** aggregation runs on a repo that has only git worktrees
- **THEN** the aggregated active changes are identical to v1.8.1 git-worktree-only aggregation
