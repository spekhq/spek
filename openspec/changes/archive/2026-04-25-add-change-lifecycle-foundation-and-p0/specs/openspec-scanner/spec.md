## MODIFIED Requirements

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

### Requirement: Parse change artifacts
The scanner SHALL read individual change directories and extract available artifacts. The returned `ChangeDetail` SHALL include the same `createdDate` and `archivedDate` fields as `ChangeInfo`, sourced from the same locations (`.openspec.yaml` frontmatter and archive folder name prefix respectively).

#### Scenario: Change with all artifacts
- **WHEN** scanner reads a change directory containing proposal.md, design.md, tasks.md, and specs/
- **THEN** it returns the raw Markdown content for each artifact and a list of delta spec files
- **AND** the returned `ChangeDetail` SHALL include `createdDate` and `archivedDate` fields populated as for the corresponding `ChangeInfo`

#### Scenario: Change with partial artifacts
- **WHEN** scanner reads a change directory containing only proposal.md
- **THEN** it returns proposal content and null for missing artifacts
