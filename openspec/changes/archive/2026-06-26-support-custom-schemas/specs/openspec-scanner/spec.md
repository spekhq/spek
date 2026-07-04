## MODIFIED Requirements

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
