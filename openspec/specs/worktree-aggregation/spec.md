## Purpose

跨 git worktree 聚合 OpenSpec 內容：探索同一 repo 的所有 worktree，把各 worktree 進行中的 change 合併呈現，讓使用者指向任一 worktree 都能掌握整個 repo 的全貌。
## Requirements
### Requirement: Discover git worktrees

The `@spekjs/core` package SHALL provide an async function `listWorktrees(dir)` that returns all git worktrees belonging to the same repository as `dir`, by executing `git worktree list --porcelain` with `dir` as the working directory. Each returned `WorktreeInfo` SHALL include `path` (absolute), `branch` (branch name or null when detached), `head` (commit hash), `isMain` (true for the main worktree), and `isBare`. When `dir` is not inside a git repository, `git` is unavailable, or the command fails, the function SHALL return an empty array.

#### Scenario: Repo with multiple worktrees

- **WHEN** `listWorktrees(dir)` is called and `dir` belongs to a repo with a main worktree and two linked worktrees
- **THEN** it returns three `WorktreeInfo` entries
- **AND** the main worktree entry has `isMain: true` and appears first

#### Scenario: Called from a linked worktree

- **WHEN** `listWorktrees(dir)` is called and `dir` is itself a linked worktree
- **THEN** it still returns every worktree of the repository, with the main worktree first

#### Scenario: Not a git repository

- **WHEN** `listWorktrees(dir)` is called and `dir` is not inside a git repository, or `git` is not installed
- **THEN** it returns an empty array

#### Scenario: Detached HEAD worktree

- **WHEN** a worktree has a detached HEAD
- **THEN** its `WorktreeInfo.branch` SHALL be null

### Requirement: Worktree source identity

Each worktree SHALL have a stable identifier `key` derived from a hash of its absolute path, URL-safe and stable across runs on the same machine. Aggregated changes SHALL carry a `WorktreeSource` value containing `key`, `path`, `branch`, and `isMain`.

#### Scenario: Stable key for a worktree

- **WHEN** the same worktree path is processed in two separate scans
- **THEN** its `WorktreeSource.key` SHALL be identical in both

#### Scenario: Distinct keys for distinct worktrees

- **WHEN** two worktrees have different absolute paths
- **THEN** their `WorktreeSource.key` values SHALL differ

### Requirement: Aggregate active changes across worktrees

When aggregation runs over multiple worktrees, the aggregated active changes SHALL contain exactly one entry per active change slug, deduplicated across all worktrees. For a given slug, the **candidates** are the copies that have **advanced past their merge-base**. A non-main worktree is a candidate when its `HEAD` advances `openspec/changes/<slug>/` beyond its merge-base with the main worktree (three-dot `git diff <mainHead>...<wtHead>`), OR it has uncommitted modifications under that path. The main worktree competes on the same terms: it is a candidate only when the contest is live (at least one worktree diverges on the slug) AND it has itself advanced past that worktree's merge-base (reverse three-dot `git diff <wtHead>...<mainHead>`) or has uncommitted modifications there — the main worktree is never automatically beaten by a diverging worktree. A copy that merely inherited the change directory without advancing it (e.g. a freshly created worktree) SHALL NOT be a candidate, regardless of filesystem mtime. When no worktree diverges for a slug, the main worktree's copy SHALL win. Among the candidates, the copy whose change directory has the most recently modified file (by filesystem mtime) SHALL win. When divergence cannot be determined because a git command fails, that copy SHALL be treated as not diverging. Each aggregated active change SHALL carry a `source` (`WorktreeSource`) identifying the worktree whose copy won, and the aggregated entry's content (including `taskStats`) SHALL be read from that winning copy.

#### Scenario: Active changes union with source

- **WHEN** worktree A has active change `add-foo` and worktree B has active change `add-bar`
- **THEN** the aggregated active list contains both, `add-foo` with `source` pointing to A and `add-bar` with `source` pointing to B

#### Scenario: Diverging worktree copy shadows main copy of the same slug

- **WHEN** the main worktree and worktree A both have an active change with slug `add-foo`, and worktree A has advanced `add-foo` (committed progress or uncommitted edits) beyond main's `HEAD`
- **THEN** the aggregated active list contains exactly one `add-foo` entry
- **AND** its `source` points to worktree A, not main
- **AND** its `taskStats` reflect worktree A's copy

#### Scenario: Inherited-but-untouched fork does not win over the editing worktree

- **WHEN** worktree A is actively editing `add-foo` (e.g. 3 of 4 tasks done), and a worktree B is created afterwards that inherits `add-foo` without touching it
- **THEN** the aggregated `add-foo` entry's `source` points to worktree A, not the more-recently-created B
- **AND** its `taskStats` report 3 of 4, not the fork-point snapshot 0 of 4

#### Scenario: Main's uncommitted edit wins over an idle fork

- **WHEN** the main worktree has uncommitted edits advancing `add-foo` to 4 of 4 tasks, and a worktree B is created afterwards that inherits `add-foo` without touching it
- **THEN** the aggregated `add-foo` entry's `source` points to main
- **AND** its `taskStats` report 4 of 4

#### Scenario: Main's committed advance wins over an idle fork

- **WHEN** the main worktree commits progress advancing `add-foo` to 4 of 4 tasks after a worktree B was created that inherits `add-foo` without touching it
- **THEN** the aggregated `add-foo` entry's `source` points to main, not the idle fork whose copy still reflects the fork-point snapshot
- **AND** its `taskStats` report 4 of 4

#### Scenario: Both main and a worktree advance the same slug — most recently modified wins

- **WHEN** the main worktree and worktree A have each advanced `add-foo` past their merge-base (each independently committed progress or edited it)
- **THEN** the aggregated `add-foo` entry is the copy whose change directory was modified most recently — the diverging worktree does not automatically beat main
- **AND** its `source` and `taskStats` reflect that most-recently-modified copy

#### Scenario: Untouched change stays on main

- **WHEN** an active change with slug `add-foo` exists only on the main worktree, with no worktree having forked or edited it
- **THEN** the aggregated active list contains exactly one `add-foo` entry with `source` pointing to main

#### Scenario: Same active slug in two diverging worktrees resolves by recency

- **WHEN** worktree A and worktree B have both advanced an active change with slug `add-foo`, and worktree B's copy has a more recently modified file
- **THEN** the aggregated active list contains exactly one `add-foo` entry
- **AND** its `source` points to worktree B

#### Scenario: Worktree whose git divergence check fails is not a candidate

- **WHEN** the main worktree has active change `add-foo` and a non-main worktree also carries `add-foo` but its divergence cannot be determined because a git command fails
- **THEN** the aggregated `add-foo` entry's `source` points to main

### Requirement: Aggregate archived changes across worktrees

When aggregation runs over multiple worktrees, the aggregated archived changes SHALL be the union of every worktree's archived changes DEDUPLICATED by slug. When the same archived slug exists in more than one worktree it SHALL appear once, using the main worktree's copy when present, otherwise the copy from the first worktree in which it appears. An archived change unique to a single worktree SHALL carry a `source` identifying that worktree.

#### Scenario: Shared archived change appears once

- **WHEN** an archived change `2026-01-01-old` exists in all worktrees because it propagated through merges
- **THEN** the aggregated archived list contains exactly one `2026-01-01-old` entry

#### Scenario: Worktree-unique archived change is tagged

- **WHEN** an archived change exists only in worktree B
- **THEN** the aggregated archived list includes it once with `source` pointing to B

### Requirement: Aggregation toggle with auto-detection

Aggregation SHALL be enabled automatically when more than one worktree is detected, and SHALL be controllable by an `aggregate` option that defaults to true. When `aggregate` is false, or only one worktree (or none) is detected, scanning SHALL behave exactly as scanning the single given directory, and the resulting changes SHALL NOT carry a `source`.

#### Scenario: Auto-aggregate on multiple worktrees

- **WHEN** scanning runs with the default `aggregate` option and the repo has multiple worktrees
- **THEN** changes from all worktrees are aggregated

#### Scenario: Single worktree behaves as today

- **WHEN** scanning runs and the repo has only one worktree
- **THEN** the result is identical to scanning that directory without aggregation

#### Scenario: Aggregation explicitly disabled

- **WHEN** scanning runs with `aggregate` set to false
- **THEN** only the given directory is scanned and no `source` is attached to changes

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

