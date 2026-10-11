# Spec Delta

## ADDED Requirements

### Requirement: Graph uses full nested topic identity
The graph SHALL create one spec node per full topic path and connect a change to a spec only when its delta has that exact topic. A spec node's visible label SHALL be the topic's final path segment, and the full topic path SHALL be available as the node's tooltip; click navigation SHALL use the full topic path taken from the node's identity, never from its displayed label. Under worktree aggregation, spec nodes SHALL continue to come only from the main worktree.

#### Scenario: Parent and child have separate nodes
- **WHEN** main specs contain `contracts/pagination` and `contracts/pagination/streaming-search`
- **THEN** the graph contains distinct nodes for both topics
- **AND** a change delta for the child creates an edge only to the child node

#### Scenario: Nested node label
- **WHEN** the graph shows the spec node for `contracts/pagination/streaming-search`
- **THEN** its label reads `streaming-search`
- **AND** hovering it shows `contracts/pagination/streaming-search`

#### Scenario: Nested node navigation
- **WHEN** a user clicks the `contracts/pagination/streaming-search` spec node
- **THEN** the app opens `/specs/contracts/pagination/streaming-search`

#### Scenario: Same-named nodes navigate to their own topics
- **WHEN** main specs contain `contracts/streaming-search` and `guides/streaming-search`, both labelled `streaming-search`
- **THEN** clicking each node opens its own full topic, not the other's
