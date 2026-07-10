## MODIFIED Requirements

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
