## MODIFIED Requirements

### Requirement: Core graph data builder
The system SHALL provide a `buildGraphData(repoDir)` function in `@spekjs/core` that scans the openspec directory and returns structured graph data. The function SHALL reuse the existing scan logic to identify which changes contain delta specs for which topics.

#### Scenario: Build graph data from repo
- **WHEN** `buildGraphData("/path/to/repo")` is called
- **AND** the repo has 3 specs and 2 changes, where change A modifies spec 1 and spec 2, and change B modifies spec 2 and spec 3
- **THEN** the function returns 5 nodes (3 specs + 2 changes) and 4 edges

### Requirement: Aggregated graph data builder

The `@spekjs/core` package SHALL provide an async function `buildGraphDataAggregated(dir)` that returns graph data aggregated across all worktrees of the repository, applying the worktree-aggregation rules. Change node ids SHALL be namespaced as `change:<worktreeKey>:<slug>` to prevent collisions between same-slug changes from different worktrees. Spec nodes SHALL be taken from the main worktree only. The existing synchronous `buildGraphData` function SHALL remain unchanged.

#### Scenario: Build aggregated graph data

- **WHEN** `buildGraphDataAggregated("/path/to/repo")` is called and the repo has multiple worktrees
- **THEN** change nodes cover every worktree, with ids of the form `change:<worktreeKey>:<slug>`

#### Scenario: buildGraphData remains unchanged

- **WHEN** `buildGraphData("/path/to/repo")` is called
- **THEN** it returns single-directory graph data exactly as before this change
