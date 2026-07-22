## ADDED Requirements

### Requirement: Graph change node ids are interpreted in one place

`@spekjs/ui` SHALL resolve a graph change node back to its change slug through a single shared helper,
used by every component and exported helper that needs a slug — today `SpecGraph` and the timeline's
`changeTopicsMap`.

The helper SHALL derive the slug from the node's `source` (populated only on aggregated graphs) rather
than by parsing separators out of the id, so that a slug containing the separator is not truncated.

The helper SHALL live in `@spekjs/ui` and SHALL be part of the package's public API, so that a host
consuming the exported graph helpers can resolve node ids the same way the components do.

**Rationale**: the two consumers previously disagreed — `SpecGraph` stripped the worktree key from
`change:<worktreeKey>:<slug>` while `changeTopicsMap` did not — and the disagreement was invisible,
because the timeline renders identically whether or not topics resolved. The helper cannot be sourced
from `@spekjs/core` instead: the existing peer-dependency requirement already establishes that this
package uses core for types only, and a runtime import would pull core's server-only modules into a
browser bundle.

#### Scenario: Non-aggregated node id

- **WHEN** the helper is given a change node whose id is `change:<slug>` and which carries no `source`
- **THEN** it returns `<slug>`

#### Scenario: Aggregated node id

- **WHEN** the helper is given a change node whose id is `change:<worktreeKey>:<slug>` and whose `source`
  identifies that worktree
- **THEN** it returns `<slug>`, without the worktree key

#### Scenario: Both consumers agree

- **WHEN** the same aggregated graph is passed to `SpecGraph` and to `changeTopicsMap`
- **THEN** both resolve a given change node to the same slug

#### Scenario: Host resolves a node id

- **WHEN** a host imports the helper from the package
- **THEN** it is exported from the package entry point, so the host need not re-implement id parsing
