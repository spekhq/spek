## MODIFIED Requirements

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
