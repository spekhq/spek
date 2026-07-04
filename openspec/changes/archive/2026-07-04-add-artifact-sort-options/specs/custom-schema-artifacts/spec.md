## MODIFIED Requirements

### Requirement: Recency-based artifact ordering
The system SHALL order a change's discovered artifacts by filesystem modification time, most recently modified first, independent of which OpenSpec schema the change declares. Each root `*.md` artifact SHALL take its own file modification time; the `specs` artifact SHALL take the most recent modification time among its discovered `specs/**/spec.md` delta files. When two or more artifacts share the same modification time, the system SHALL break the tie with a stable default order — `proposal`, `design`, `specs`, `tasks` first, then the remainder alphabetically. Computing this default recency order of `ChangeDetail.artifacts` — and all directory scanning (change lists, overview, aggregation) — SHALL NOT invoke the OpenSpec CLI, spawn any subprocess, or parse any schema definition. A user MAY opt into a schema-order view that consults the OpenSpec authority for its ordering (per "User-selectable artifact tab ordering" below); that view never changes this default recency order. Artifact display titles SHALL always be humanized from filenames.

#### Scenario: Most recently modified artifact leads
- **WHEN** a change contains `proposal.md`, `design.md`, and `tasks.md`, and `tasks.md` has the newest modification time
- **THEN** the discovered artifacts are ordered with `tasks` first

#### Scenario: Equal modification times fall back to the stable default order
- **WHEN** every artifact file in a change shares the same modification time (for example, immediately after a fresh `git clone` or `checkout`)
- **THEN** the artifacts are ordered `proposal`, `design`, `specs`, `tasks` first, then any remaining artifacts alphabetically

#### Scenario: Default recency order and scanning never call the CLI
- **WHEN** a change detail's default (recency) order is computed, or any directory scan runs
- **THEN** no OpenSpec CLI invocation, subprocess, or schema-definition parsing occurs

## ADDED Requirements

### Requirement: User-selectable artifact tab ordering
The change-detail view SHALL provide a control letting the user choose how change artifacts are ordered, with three modes: **last-modified** (the default, labeled "Last modified" — the mtime order per "Recency-based artifact ordering"), **schema order** (the schema's authoritative artifact sequence), and **alphabetical** (by artifact title). The selected mode SHALL be persisted so it applies to every change the user opens (global persistence), and SHALL default to last-modified when no preference is stored or when persistence is unavailable. Reordering SHALL affect only tab order, not which artifacts are present. This control SHALL be available on every surface that renders the change-detail view (web, VS Code, IntelliJ).

#### Scenario: Last-modified is the default
- **WHEN** a user opens a change detail with no stored ordering preference
- **THEN** the artifacts are ordered by last-modified time (newest first) and the control indicates the last-modified mode is active

#### Scenario: Alphabetical ordering
- **WHEN** the user selects alphabetical ordering
- **THEN** the artifact tabs are ordered by their display title, A–Z

#### Scenario: Preference persists across changes
- **WHEN** the user selects an ordering mode and then opens a different change
- **THEN** the newly opened change uses the same ordering mode

#### Scenario: Ordering never changes the set of artifacts
- **WHEN** the user switches between ordering modes
- **THEN** the same set of artifacts is shown in every mode, only their order differs

### Requirement: Schema order sourced from the OpenSpec authority
When ordering by schema order, the system SHALL order artifacts by the schema's authoritative sequence obtained from the OpenSpec authority — the `openspec` CLI's `actionContext.planningArtifacts` (order) mapped to discovered artifacts via `artifactPaths[id].outputPath` — so that the order is correct for any schema, including custom schemas, and not only `spec-driven`. This authoritative sequence SHALL be exposed to the view as `ChangeDetail.schemaOrder` (an ordered list of artifact ids, or null when unavailable). Computing it SHALL NOT change the default recency order of `ChangeDetail.artifacts`, and directory scanning (change lists / overview / aggregation) SHALL NOT invoke the CLI.

#### Scenario: Schema order follows a custom schema
- **WHEN** a change is authored under a custom schema whose `planningArtifacts` is `[brainstorm, proposal, plan, verify, retrospective]` and the `openspec` CLI is available
- **THEN** in schema-order mode the artifact tabs follow that sequence, not a spec-driven or alphabetical order

#### Scenario: Default order and scanning are unaffected
- **WHEN** `schemaOrder` is computed for a change detail
- **THEN** the `artifacts` array remains in recency order and no CLI call is made while scanning changes

### Requirement: Transparent fallback when schema order is unavailable
When schema-order mode is active but the authoritative order is unavailable — the `openspec` CLI is not installed, or the change is archived (no `planningArtifacts`) — the system SHALL fall back to the default `proposal, design, specs, tasks` then alphabetical order AND SHALL clearly indicate to the user that a fallback is in effect, with a reason-specific message. The indication SHALL distinguish the missing-CLI case (which installing the CLI would resolve) from the archived-change case (which it would not).

#### Scenario: CLI missing on an active change
- **WHEN** schema-order mode is active for an active change and the `openspec` CLI is not available (`schemaOrder` is null)
- **THEN** the tabs use the default spec-driven order and the view shows a message stating the OpenSpec CLI is not available

#### Scenario: Archived change
- **WHEN** schema-order mode is active for an archived change (`schemaOrder` is null)
- **THEN** the tabs use the default order and the view shows a message stating schema order is not tracked for archived changes

#### Scenario: No fallback indicator when schema order is available
- **WHEN** schema-order mode is active and `schemaOrder` is present
- **THEN** the tabs follow the schema order and no fallback message is shown
