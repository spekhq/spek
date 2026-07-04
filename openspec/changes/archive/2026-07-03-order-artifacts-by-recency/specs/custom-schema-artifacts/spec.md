## ADDED Requirements

### Requirement: Recency-based artifact ordering
The system SHALL order a change's discovered artifacts by filesystem modification time, most recently modified first, independent of which OpenSpec schema the change declares. Each root `*.md` artifact SHALL take its own file modification time; the `specs` artifact SHALL take the most recent modification time among its discovered `specs/**/spec.md` delta files. When two or more artifacts share the same modification time, the system SHALL break the tie with a stable default order — `proposal`, `design`, `specs`, `tasks` first, then the remainder alphabetically. The system SHALL NOT invoke the OpenSpec CLI, spawn any subprocess, or parse any schema definition to order artifacts. Artifact display titles SHALL always be humanized from filenames.

#### Scenario: Most recently modified artifact leads
- **WHEN** a change contains `proposal.md`, `design.md`, and `tasks.md`, and `tasks.md` has the newest modification time
- **THEN** the discovered artifacts are ordered with `tasks` first

#### Scenario: specs tree ordered by its newest delta file
- **WHEN** a change contains `specs/<topic>/spec.md` delta files and one of them is the most recently modified file in the change
- **THEN** the `specs` artifact leads the ordered list

#### Scenario: Equal modification times fall back to the stable default order
- **WHEN** every artifact file in a change shares the same modification time (for example, immediately after a fresh `git clone` or `checkout`)
- **THEN** the artifacts are ordered `proposal`, `design`, `specs`, `tasks` first, then any remaining artifacts alphabetically

#### Scenario: Custom-schema artifacts ordered without a schema
- **WHEN** a change declares a custom schema and contains `brainstorm.md`, `proposal.md`, `plan.md`, and `tasks.md`
- **THEN** the artifacts are ordered by modification time (newest first) with the stable tiebreak, and no OpenSpec CLI call is made

#### Scenario: Humanized title
- **WHEN** an artifact is sourced from a file named `retrospective.md`
- **THEN** its display title is `Retrospective`

## REMOVED Requirements

### Requirement: Authoritative artifact ordering delegated to OpenSpec
**Reason**: Ordering by the OpenSpec CLI's authoritative schema order pins `tasks` last for every schema, burying the living execution document during a run. Ordering is a presentation concern the viewer owns; recency ordering is simpler, schema-agnostic, and needs no subprocess.
**Migration**: Ordering is now determined by filesystem modification time with a stable default tiebreak (see "Recency-based artifact ordering"). The `openspec status --change <slug> --json` call, the `schema-order` module, and the `slug` / `orderProvider` parameters of `discoverArtifacts` are removed. Schema *awareness* is unaffected — the schema name is still surfaced per "Surface the schema name per change".
