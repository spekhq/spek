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

When aggregation runs over multiple worktrees, the aggregated active changes SHALL contain exactly one entry per active change slug, deduplicated across all worktrees. For a given slug, a non-main worktree's copy SHALL take priority over the main worktree's copy of the same slug. When the slug is present in more than one non-main worktree, the copy whose change directory has the most recently modified file (by filesystem mtime) SHALL win. Each aggregated active change SHALL carry a `source` (`WorktreeSource`) identifying the worktree whose copy won.

#### Scenario: Active changes union with source

- **WHEN** worktree A has active change `add-foo` and worktree B has active change `add-bar`
- **THEN** the aggregated active list contains both, `add-foo` with `source` pointing to A and `add-bar` with `source` pointing to B

#### Scenario: Worktree copy shadows main copy of the same slug

- **WHEN** the main worktree and worktree A both have an active change with slug `add-foo`
- **THEN** the aggregated active list contains exactly one `add-foo` entry
- **AND** its `source` points to worktree A, not main

#### Scenario: Untouched change stays on main

- **WHEN** an active change with slug `add-foo` exists only on the main worktree, with no worktree having forked or edited it
- **THEN** the aggregated active list contains exactly one `add-foo` entry with `source` pointing to main

#### Scenario: Same active slug in two non-main worktrees resolves by recency

- **WHEN** worktree A and worktree B both have an active change with slug `add-foo`, and worktree B's copy has a more recently modified file
- **THEN** the aggregated active list contains exactly one `add-foo` entry
- **AND** its `source` points to worktree B

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
