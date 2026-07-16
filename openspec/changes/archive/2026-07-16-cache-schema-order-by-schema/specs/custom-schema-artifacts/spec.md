## ADDED Requirements

### Requirement: Schema-order authority is cached per schema

Because the authoritative artifact sequence returned by the OpenSpec authority (`actionContext.planningArtifacts` + `artifactPaths`) is a property of the change's **schema**, not of the individual change, the system SHALL cache that authoritative result keyed by schema within a repo, so that opening multiple changes that share a schema consults the OpenSpec authority (spawning the `openspec` CLI) at most once per distinct schema within the cache window, rather than once per change. When spek cannot resolve a schema **name** for a change locally (neither the change nor the repo declares one), this does NOT mean no authoritative order exists — the OpenSpec authority resolves its own built-in default and still returns an order — so the system SHALL still consult the authority for such changes and SHALL cache them under a single repo-level default bucket (they all resolve to the same default, so one shared bucket is a correct share, not a collision). This caching SHALL NOT change the `schemaOrder` value delivered for any change: the per-change mapping onto that change's discovered artifact ids is applied after the cached authoritative result, so each change still reports the order correct for its own artifacts.

#### Scenario: Second change sharing a schema reuses the cached authority

- **WHEN** an active change is opened, its schema's authoritative order is fetched from the OpenSpec authority, and then a different active change declaring the **same** schema in the same repo is opened within the cache window
- **THEN** the second change's `schemaOrder` is served from the cached authoritative result without consulting the OpenSpec authority again

#### Scenario: schemaOrder is unchanged by per-schema caching

- **WHEN** two changes share a schema but have different sets of discovered artifacts, and both are ordered by schema order
- **THEN** each change's `schemaOrder` reflects only its own discovered artifact ids, identical to what per-change computation would have produced

#### Scenario: A change with no locally-resolvable schema still gets the default order

- **WHEN** an active change whose schema spek cannot resolve locally (no repo `config.yaml` and no change `.openspec.yaml` schema) is opened while the `openspec` CLI is available
- **THEN** the authority is still consulted and the change's `schemaOrder` is the authority's default-schema order (not null)

#### Scenario: Schema-less changes in a repo share one spawn

- **WHEN** two active changes in the same repo both have no locally-resolvable schema and are opened within the cache window
- **THEN** they share a single repo-level default cache bucket, so the authority is spawned only once for both
