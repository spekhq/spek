## ADDED Requirements

### Requirement: Graph covers jj workspaces

The relationship graph SHALL include change nodes from jj workspaces when jj inclusion is enabled,
using the same `change:<workspaceKey>:<slug>` namespacing as git worktrees so same-slug changes from
different workspaces do not collide. Because jj workspaces materialise the full trunk, the graph SHALL
apply the same content-identity deduplication as the scanner (per `jj-workspace-aggregation`) to jj
change nodes: a jj change whose content is byte-identical to one already added SHALL NOT produce a
duplicate node, and its edges SHALL be skipped so referenced specs' history counts are not inflated.
jj workspaces SHALL NOT be fed into the git divergence election that resolves git-worktree nodes.
Divergent jj copies remain distinct nodes via their differing workspace keys.

#### Scenario: jj workspace change appears as a node

- **WHEN** the aggregated graph is built on a repo with an added jj workspace whose active change has a
  spec delta
- **THEN** that change appears as a node with id `change:<workspaceKey>:<slug>` and a `source` whose
  `vcs === "jj"`

#### Scenario: Identical jj copies do not duplicate nodes

- **WHEN** a trunk change with a spec delta is materialised identically across multiple jj workspaces
- **THEN** the graph contains a single node for that change and the referenced spec's history count is
  not inflated
