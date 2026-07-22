## MODIFIED Requirements

### Requirement: Group by spec topic toggle

The timeline SHALL provide a toggle that, when enabled, groups bars into lanes by the spec topic each change affects.

Topic grouping SHALL produce the same lanes whether the graph data came from a single working directory
or from worktree/workspace aggregation. Aggregated graphs namespace change node ids by the winning
worktree (`change:<worktreeKey>:<slug>`); the timeline SHALL resolve such an id back to its plain slug
before matching it against the changes it renders.

#### Scenario: Toggle off shows flat lane list

- **WHEN** the group toggle is off (default)
- **THEN** all changes are listed as one column of lanes ordered by `createdDate` ascending

#### Scenario: Toggle on groups by topic

- **WHEN** the group toggle is on
- **THEN** lanes are grouped under section headers per spec topic
- **AND** changes affecting multiple topics appear as a separate bar in each topic's group

#### Scenario: Multi-topic change indicator

- **WHEN** a change appears in multiple topic groups
- **THEN** each occurrence's tooltip lists all affected topics

#### Scenario: Grouping under worktree aggregation

- **WHEN** the group toggle is on and the graph was built with aggregation across more than one worktree,
  so its change node ids carry a worktree key
- **THEN** each change is grouped under the spec topics its node is connected to, exactly as it would be
  without aggregation
- **AND** a change is placed in the no-topic lane only when none of its spec edges resolve to a spec node
  present in the graph
