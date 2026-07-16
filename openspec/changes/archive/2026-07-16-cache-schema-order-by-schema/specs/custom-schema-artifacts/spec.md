## ADDED Requirements

### Requirement: Schema-order authority is cached per schema

Because the authoritative artifact sequence returned by the OpenSpec authority (`actionContext.planningArtifacts` + `artifactPaths`) is a property of the change's **schema**, not of the individual change, the system SHALL cache that authoritative result keyed by schema within a repo, so that opening multiple changes that share a schema consults the OpenSpec authority (spawning the `openspec` CLI) at most once per distinct schema within the cache window, rather than once per change. When a change has no schema (its resolved schema is null or empty), there is no authoritative order to obtain, so the system SHALL NOT consult the OpenSpec authority (no CLI spawn) and SHALL report `schemaOrder` as null. This caching SHALL NOT change the `schemaOrder` value delivered for any change: the per-change mapping onto that change's discovered artifact ids is applied after the cached authoritative result, so each change still reports the order correct for its own artifacts.

#### Scenario: Second change sharing a schema reuses the cached authority

- **WHEN** an active change is opened, its schema's authoritative order is fetched from the OpenSpec authority, and then a different active change declaring the **same** schema in the same repo is opened within the cache window
- **THEN** the second change's `schemaOrder` is served from the cached authoritative result without consulting the OpenSpec authority again

#### Scenario: schemaOrder is unchanged by per-schema caching

- **WHEN** two changes share a schema but have different sets of discovered artifacts, and both are ordered by schema order
- **THEN** each change's `schemaOrder` reflects only its own discovered artifact ids, identical to what per-change computation would have produced

#### Scenario: A change with no schema is never sent to the authority

- **WHEN** an active change whose resolved schema is null or empty is opened
- **THEN** the OpenSpec authority is not consulted (no `openspec` CLI spawn) and the change's `schemaOrder` is null
