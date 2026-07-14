## MODIFIED Requirements

### Requirement: Aggregated change nodes from worktrees
When the graph is built from aggregated worktree data, change nodes SHALL include one node per active change slug (deduplicated using the **same divergence-based election as the aggregated active changes list**: a non-main worktree wins a slug only when it has diverged from main's `HEAD` for that change, otherwise the slug stays on main; most-recently-modified-mtime breaks ties among diverging worktrees) plus the slug-deduplicated archived changes. Change node ids SHALL be namespaced by the winning worktree (`change:<worktreeKey>:<slug>`). Spec nodes SHALL come only from the main worktree.

#### Scenario: Same-slug active changes deduplicate to one node

- **WHEN** the main worktree and worktree A both have an active change with slug `add-foo`, and worktree A has diverged (advanced its copy beyond main's `HEAD`)
- **THEN** the graph contains exactly one change node for `add-foo`
- **AND** its id is namespaced by worktree A's key, not main's

#### Scenario: Inherited-but-untouched fork does not own the node

- **WHEN** the main worktree has active change `add-foo` and a worktree B created afterwards inherits it without diverging
- **THEN** the graph contains exactly one change node for `add-foo`
- **AND** its id is namespaced by main's key, not B's

#### Scenario: Distinct active changes stay distinct

- **WHEN** worktree A has active change `add-foo` and worktree B has active change `add-bar`
- **THEN** the graph contains two distinct change nodes, one per slug
- **AND** each connects to the spec nodes its own delta specs reference

#### Scenario: Spec nodes from main worktree
- **WHEN** the graph is built from aggregated worktree data
- **THEN** spec nodes are taken only from the main worktree

#### Scenario: Deduplication removes duplicate edges from spec fan-in

- **WHEN** an active change `add-foo` with a delta spec exists in both main and worktree A, and worktree A has diverged so it wins the slug
- **THEN** the graph contains exactly one `change:...:add-foo` → spec edge
- **AND** the spec node's `historyCount` counts that edge once, not once per worktree
