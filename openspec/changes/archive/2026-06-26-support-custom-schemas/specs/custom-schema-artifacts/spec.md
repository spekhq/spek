## ADDED Requirements

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

### Requirement: Authoritative artifact ordering delegated to OpenSpec
The system SHALL NOT parse or validate schema definitions itself. Instead it SHALL delegate to the OpenSpec authority (the `openspec` CLI) to obtain a change's authoritative ordered artifact list, by running `openspec status --change <slug> --json` and reading `actionContext.planningArtifacts` (the order) together with `artifactPaths[id].outputPath` (each artifact's literal filename or glob). The discovered files SHALL then be ordered to match: each authoritative entry is mapped to a discovered artifact by its `outputPath` (literal filename, or a `specs`-targeting glob mapping to the specs artifact), and discovered artifacts with no authoritative match SHALL be appended after the ordered ones (with `proposal`, `design`, `specs`, `tasks` first, then the remainder alphabetically). When the authoritative order is unavailable for any reason — the CLI is not installed, exits non-zero, the change is archived, or the output cannot be parsed — the system SHALL fall back to that same default ordering. Artifact display titles SHALL always be humanized from filenames; the system SHALL NOT depend on the CLI being present.

#### Scenario: Order follows OpenSpec for a custom schema
- **WHEN** a change declares `schema: superpowers-bridge` and `openspec status --change <slug> --json` reports `planningArtifacts: [brainstorm, proposal, design, specs, tasks, plan, verify, retrospective]`
- **THEN** the change's discovered artifacts are ordered to match that authoritative list

#### Scenario: Glob outputPath maps to the specs tree
- **WHEN** an authoritative entry has `outputPath: "specs/**/*.md"`
- **THEN** that entry is mapped to the discovered `specs` artifact

#### Scenario: Discovered file absent from the authoritative list is appended
- **WHEN** a change contains a `scratch.md` file that no authoritative entry maps to
- **THEN** `scratch.md` is still surfaced as an artifact, ordered after all authoritatively-ordered artifacts

#### Scenario: CLI unavailable falls back to default ordering
- **WHEN** the `openspec` CLI is not installed, errors, or the change is archived (so no authoritative order is available)
- **THEN** all discovered artifacts are still surfaced, ordered `proposal, design, specs, tasks` first then the remainder alphabetically, with filename-humanized titles

#### Scenario: Humanized title
- **WHEN** an artifact is sourced from a file named `retrospective.md`
- **THEN** its display title is `Retrospective`

#### Scenario: No re-implementation of the schema format
- **WHEN** the schema format changes upstream in OpenSpec
- **THEN** spek requires no change to interpret artifact ordering, because it reads the CLI's computed result rather than parsing `schema.yaml` itself

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
