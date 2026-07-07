## Purpose

掃描 openspec/ 目錄結構，解析 specs 與 changes 並產出結構化資料。

## Requirements

### Requirement: Scan OpenSpec directory structure
The scanner SHALL be an async function in the `@spek/core` package that reads an OpenSpec directory and returns its complete structure including specs, active changes, and archived changes. Each `ChangeInfo` SHALL include a `timestamp` field (ISO 8601 string or null) obtained from the git timestamp cache, a `createdDate` field (string in `YYYY-MM-DD` format or null) parsed from the change's `.openspec.yaml` `created` frontmatter field, and an `archivedDate` field (string in `YYYY-MM-DD` format or null). The `archivedDate` SHALL be derived from the archive folder name prefix `YYYY-MM-DD-slug` for archived changes only, and SHALL be null for active changes. Changes SHALL be sorted by timestamp descending (most recent first), falling back to slug date when timestamp is unavailable. It SHALL use Node.js `fs` directly and have no dependency on Express or any HTTP framework.

#### Scenario: Scan repo with full OpenSpec structure
- **WHEN** scanner is given a repo path containing `openspec/specs/` and `openspec/changes/`
- **THEN** it returns a structure with `specs` (list of topic names), `activeChanges` (changes directly under `openspec/changes/` excluding `archive/`), and `archivedChanges` (changes under `openspec/changes/archive/`)
- **AND** each `ChangeInfo` SHALL include `timestamp`, `createdDate`, and `archivedDate` fields

#### Scenario: Scan repo with empty OpenSpec directory
- **WHEN** scanner is given a repo path where `openspec/` exists but contains only `config.yaml`
- **THEN** it returns empty arrays for specs, activeChanges, and archivedChanges

#### Scenario: Sort changes by timestamp
- **WHEN** multiple changes exist with the same slug date (e.g., `2026-02-17-foo` and `2026-02-17-bar`)
- **THEN** changes SHALL be sorted by git timestamp descending (most recent first)

#### Scenario: Sort changes without git timestamps
- **WHEN** the repo is not a git repository or changes have no git history
- **THEN** changes SHALL be sorted by slug date descending as fallback
- **AND** all `timestamp` fields SHALL be null

#### Scenario: Read createdDate from .openspec.yaml frontmatter
- **WHEN** a change directory contains `.openspec.yaml` with a line `created: 2026-04-20`
- **THEN** the corresponding `ChangeInfo.createdDate` SHALL equal the string `"2026-04-20"`

#### Scenario: createdDate missing or yaml absent
- **WHEN** a change directory has no `.openspec.yaml`, or the file does not contain a `created` field, or the value does not match `YYYY-MM-DD`
- **THEN** `ChangeInfo.createdDate` SHALL be null

#### Scenario: archivedDate derived for archive change
- **WHEN** an archive change directory is named `2026-02-22-fix-x`
- **THEN** the corresponding `ChangeInfo.archivedDate` SHALL equal the string `"2026-02-22"`

#### Scenario: archivedDate is null for active change
- **WHEN** an active change is scanned (under `openspec/changes/` not in `archive/`)
- **THEN** `ChangeInfo.archivedDate` SHALL be null

### Requirement: YAML frontmatter parsing tolerates line-ending styles
The scanner's `.openspec.yaml` frontmatter parser SHALL correctly extract the `created` field regardless of the file's line-ending style, so that `createdDate` is not lost for files using CRLF (`\r\n`) line endings. Parsing SHALL split content on both `\r\n` and `\n`, leaving no trailing carriage return that would prevent the `created` value from matching.

#### Scenario: CRLF line endings preserve createdDate
- **WHEN** a change's `.openspec.yaml` uses CRLF (`\r\n`) line endings and contains `created: 2026-07-05`
- **THEN** the corresponding `ChangeInfo.createdDate` SHALL equal the string `"2026-07-05"`

#### Scenario: LF line endings remain unaffected
- **WHEN** a change's `.openspec.yaml` uses LF (`\n`) line endings and contains `created: 2026-07-05`
- **THEN** the corresponding `ChangeInfo.createdDate` SHALL equal the string `"2026-07-05"`

### Requirement: Parse change artifacts
The scanner SHALL read individual change directories and dynamically discover their artifacts rather than detecting a fixed set of files. It SHALL discover every regular `*.md` file at the change root and a non-empty `specs/` delta tree, classify each by kind (`tasks`, `specs`, or `markdown`), optionally enrich ordering/title/description from the change's resolved schema, and return them as an ordered `artifacts` array on `ChangeDetail`. The returned `ChangeDetail` SHALL continue to include the same `createdDate` and `archivedDate` fields as `ChangeInfo`, sourced from the same locations (`.openspec.yaml` frontmatter and archive folder name prefix respectively). `ChangeInfo` SHALL continue to expose lightweight presence flags so list views need not read full artifact content.

#### Scenario: Change with spec-driven artifacts
- **WHEN** scanner reads a change directory containing proposal.md, design.md, tasks.md, and specs/
- **THEN** it returns an ordered `artifacts` array with markdown artifacts for proposal and design, a tasks artifact with parsed task data, and a specs artifact listing the delta spec files
- **AND** the returned `ChangeDetail` SHALL include `createdDate` and `archivedDate` fields populated as for the corresponding `ChangeInfo`

#### Scenario: Change with custom-schema artifacts
- **WHEN** scanner reads a change directory containing brainstorm.md, proposal.md, plan.md, and verify.md
- **THEN** the returned `artifacts` array includes an entry for each of those markdown files, ordered and titled per the resolved schema when available

#### Scenario: Change with partial artifacts
- **WHEN** scanner reads a change directory containing only proposal.md
- **THEN** the returned `artifacts` array contains a single markdown artifact for the proposal and no entries for absent files

### Requirement: Read spec content
The scanner SHALL read spec files and return their Markdown content.

#### Scenario: Read existing spec
- **WHEN** scanner reads `openspec/specs/{topic}/spec.md`
- **THEN** it returns the raw Markdown content of the spec file

### Requirement: Detect related changes for a spec
The scanner SHALL identify which changes contain delta specs for a given spec topic.

#### Scenario: Spec with related changes
- **WHEN** scanner checks for changes related to spec topic "simulation-engine"
- **THEN** it returns all change slugs that have a `specs/simulation-engine/spec.md` delta file

### Requirement: Aggregated scan entry point

The `@spek/core` package SHALL provide an async function `scanOpenSpecAggregated(dir, options)` that returns a `ScanResult` aggregated across all worktrees of the repository containing `dir`, following the worktree-aggregation rules. Active changes SHALL be the source-tagged union of all worktrees; archived changes SHALL be the slug-deduplicated union; `specs` SHALL be taken only from the main worktree (the first non-bare worktree). Each aggregated `ChangeInfo` SHALL carry an optional `source` field of type `WorktreeSource`. The existing `scanOpenSpec` function SHALL remain unchanged and continue to scan a single directory with no `source` attached.

#### Scenario: Aggregated scan over multiple worktrees

- **WHEN** `scanOpenSpecAggregated(dir)` is called and the repo has multiple worktrees
- **THEN** `activeChanges` contains every worktree's active changes, each with a `source`
- **AND** `archivedChanges` is the slug-deduplicated union across worktrees
- **AND** `specs` contains only the main worktree's spec topics

#### Scenario: Aggregated scan falls back for single worktree

- **WHEN** `scanOpenSpecAggregated(dir)` is called and the repo has a single worktree or is not a git repository
- **THEN** the result equals `scanOpenSpec(dir)` and no `source` is attached to changes

#### Scenario: scanOpenSpec remains unchanged

- **WHEN** `scanOpenSpec(dir)` is called
- **THEN** it scans only `dir` and its `ChangeInfo` entries carry no `source`, exactly as before this change
