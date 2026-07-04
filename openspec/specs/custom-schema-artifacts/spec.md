## Purpose

以檔案系統為準探索 change 的 artifacts，讓任何 OpenSpec schema（含自訂 schema）的 artifact 都能各自呈現為分頁；分頁預設依最後修改時間排序，並提供使用者可選的排序（最後修改 / schema 權威順序 / A–Z）。

## Requirements

### Requirement: Filesystem-driven artifact discovery
The system SHALL determine a change's artifacts from the files present in its directory, independent of which OpenSpec schema the change declares. Every regular `*.md` file directly inside the change directory SHALL be discovered as a markdown artifact, and a `specs/` subdirectory containing one or more `*.md` delta files SHALL be discovered as a single specs artifact. Files beginning with `.` (such as `.openspec.yaml`) and non-`.md` files SHALL be ignored. Discovery SHALL be the source of truth: an artifact that is present on disk SHALL always be surfaced even when no schema is available, and a schema entry referencing an absent file SHALL never cause a missing file to be reported as present.

#### Scenario: Discover spec-driven change
- **WHEN** a change directory contains `proposal.md`, `design.md`, `tasks.md`, and `specs/<topic>/spec.md`
- **THEN** discovery returns artifacts for `proposal`, `design`, `tasks`, and a single `specs` artifact

#### Scenario: Discover unknown-schema change with extra artifacts
- **WHEN** a change directory contains `brainstorm.md`, `proposal.md`, `plan.md`, `verify.md`, and `retrospective.md`
- **THEN** discovery returns a markdown artifact for each of those files, even though they are not part of the `spec-driven` schema

#### Scenario: Ignore dotfiles and non-markdown files
- **WHEN** a change directory contains `.openspec.yaml` and a stray `notes.txt` alongside `proposal.md`
- **THEN** only `proposal.md` is discovered as an artifact and `.openspec.yaml` / `notes.txt` are ignored

#### Scenario: Empty specs directory
- **WHEN** a change directory contains a `specs/` directory with no `*.md` files
- **THEN** no specs artifact is reported

### Requirement: Artifact kind classification
Each discovered artifact SHALL be assigned a `kind` that governs how it is parsed and rendered. A `tasks.md` file SHALL be classified as kind `tasks` and parsed into structured task data (sections + checkboxes) as today. The `specs/` delta tree SHALL be classified as kind `specs` and carry the list of `{ topic, content }` delta files. All other `*.md` files SHALL be classified as kind `markdown` and carry raw Markdown content.

#### Scenario: tasks.md classified as tasks kind
- **WHEN** a change contains `tasks.md`
- **THEN** its artifact has `kind: "tasks"` and exposes parsed `{ total, completed, sections }` task data

#### Scenario: specs tree classified as specs kind
- **WHEN** a change contains `specs/<topic>/spec.md` delta files
- **THEN** a single artifact with `kind: "specs"` exposes the list of `{ topic, content }` entries

#### Scenario: Other markdown classified as markdown kind
- **WHEN** a change contains `brainstorm.md`
- **THEN** its artifact has `kind: "markdown"` and exposes the raw file content

### Requirement: Recency-based artifact ordering
The system SHALL order a change's discovered artifacts by filesystem modification time, most recently modified first, independent of which OpenSpec schema the change declares. Each root `*.md` artifact SHALL take its own file modification time; the `specs` artifact SHALL take the most recent modification time among its discovered `specs/**/spec.md` delta files. When two or more artifacts share the same modification time, the system SHALL break the tie with a stable default order — `proposal`, `design`, `specs`, `tasks` first, then the remainder alphabetically. Computing this default recency order of `ChangeDetail.artifacts` — and all directory scanning (change lists, overview, aggregation) — SHALL NOT invoke the OpenSpec CLI, spawn any subprocess, or parse any schema definition. (A user MAY opt into a schema-order view that consults the OpenSpec authority for its ordering, per "User-selectable artifact tab ordering"; that view never changes this default recency order.) Artifact display titles SHALL always be humanized from filenames.

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

### Requirement: Surface the schema name per change
Because different changes in the same repo can declare different schemas, the system SHALL expose the schema name a change was authored under (from its `.openspec.yaml` `schema:` field, falling back to the repo's `openspec/config.yaml` `schema:`) on both `ChangeInfo` and `ChangeDetail`, and the change detail UI SHALL display that schema name. When no schema name can be determined, the field SHALL be null and no schema indicator is shown.

#### Scenario: Change detail shows its schema
- **WHEN** a change's `.openspec.yaml` declares `schema: superpowers-bridge`
- **THEN** `ChangeDetail.schema` equals `"superpowers-bridge"` and the change detail page displays that schema name

#### Scenario: Different changes show different schemas
- **WHEN** one change declares `schema: spec-driven` and another declares `schema: superpowers-bridge`
- **THEN** each change reports and displays its own schema name independently

#### Scenario: Schema falls back to repo config
- **WHEN** a change has no `schema:` in its `.openspec.yaml` but the repo `openspec/config.yaml` declares `schema: spec-driven`
- **THEN** the change's reported schema is `"spec-driven"`

#### Scenario: No schema determinable
- **WHEN** neither the change nor the repo config declares a schema
- **THEN** the reported schema is null and no schema indicator is rendered

### Requirement: Generic ChangeDetail artifacts contract
`ChangeDetail` SHALL expose an ordered `artifacts` array, where each entry carries at minimum an `id`, `title`, `kind`, and the data appropriate to its kind (`content` for markdown, `tasks` for tasks, `specs` for the delta list). The API responses and every `ApiAdapter` implementation (`FetchAdapter`, `MessageAdapter`, `StaticAdapter`) SHALL carry this artifacts array so the frontend renders changes without referring to fixed artifact field names.

#### Scenario: ChangeDetail exposes ordered artifacts
- **WHEN** a change detail is requested
- **THEN** the response includes an ordered `artifacts` array with `id`, `title`, `kind`, and kind-appropriate data for each artifact

#### Scenario: Adapters preserve the artifacts array
- **WHEN** a change detail is delivered through any `ApiAdapter` (fetch, message, or static)
- **THEN** the consumer receives the same ordered `artifacts` array

### Requirement: Surface parity for custom-schema artifacts
The web app, the VS Code extension, and the IntelliJ plugin SHALL all render the full set of discovered artifacts for a change using the shared discovery and enrichment rules, and full-text search SHALL index every discovered markdown artifact rather than only `proposal.md`, `design.md`, and `tasks.md`.

#### Scenario: VS Code renders all artifacts
- **WHEN** a change with custom-schema artifacts is opened in the VS Code webview
- **THEN** all discovered artifacts are shown, matching what the web app shows for the same change

#### Scenario: IntelliJ renders all artifacts
- **WHEN** a change with custom-schema artifacts is opened in the IntelliJ tool window
- **THEN** all discovered artifacts are shown, matching what the web app shows for the same change

#### Scenario: Search indexes all markdown artifacts
- **WHEN** full-text search runs over a change that includes `brainstorm.md` and `plan.md`
- **THEN** content from `brainstorm.md` and `plan.md` is searchable, not only `proposal.md`/`design.md`/`tasks.md`
