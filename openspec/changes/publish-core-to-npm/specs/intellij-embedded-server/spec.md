## MODIFIED Requirements

### Requirement: Changes list endpoint
The server SHALL implement `GET /api/spek/openspec/changes` that returns active and archived changes. Each returned change SHALL include a `createdDate` field (string in `YYYY-MM-DD` format or null) parsed from the change's `.openspec.yaml` `created` frontmatter field, and an `archivedDate` field (string in `YYYY-MM-DD` format or null) derived from the archive folder name prefix `YYYY-MM-DD-slug` for archived changes and null for active changes, matching the `@spekjs/core` (TypeScript) contract.

#### Scenario: Changes list response
- **WHEN** `GET /api/spek/openspec/changes?projectPath=...` is called
- **THEN** it returns `{ active: [...], archived: [...] }` with change metadata

#### Scenario: Active change includes createdDate from .openspec.yaml
- **WHEN** an active change directory contains `.openspec.yaml` with `created: 2026-07-05`
- **THEN** its entry in `active` SHALL include `createdDate` equal to `"2026-07-05"` and `archivedDate` equal to null

#### Scenario: Archived change includes createdDate and archivedDate
- **WHEN** an archived change directory named `2026-07-05-foo` contains `.openspec.yaml` with `created: 2026-07-01`
- **THEN** its entry in `archived` SHALL include `createdDate` equal to `"2026-07-01"` and `archivedDate` equal to `"2026-07-05"`

#### Scenario: Missing or malformed created yields null createdDate
- **WHEN** a change has no `.openspec.yaml`, or its `created` value does not match `YYYY-MM-DD`
- **THEN** its `createdDate` SHALL be null
