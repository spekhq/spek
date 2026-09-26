# Spec Delta

## MODIFIED Requirements

### Requirement: Parse change artifacts
The scanner SHALL read individual change directories and dynamically discover their artifacts rather than detecting a fixed set of files. It SHALL discover every regular `*.md` file at the change root, every regular `.yaml`, `.yml`, or `.json` file at the change root, every regular `.mmd` or `.mermaid` file at the change root, and a non-empty `specs/` delta tree, classify each by kind (`tasks`, `specs`, `data`, `diagram`, or `markdown`), optionally enrich ordering/title/description from the change's resolved schema, and return them as an ordered `artifacts` array on `ChangeDetail`. Discovery of root files SHALL be limited to the change root. It SHALL NOT recurse into subdirectories apart from the `specs/` tree. It SHALL exclude dotfiles, so the change's own `.openspec.yaml` metadata is never surfaced as an artifact. A single source of truth SHALL drive artifact discovery, the artifact count on `ChangeInfo`, and the search index on every host. Every discovered **root** artifact is therefore both counted and searchable, whichever host renders it. The `specs` delta artifact is the one exception and SHALL be counted and rendered but not indexed: its content is the delta of a main spec that is itself indexed, so indexing it lists the same text under two names. The exception is stated here because it is otherwise read as an oversight — see the `search-semantics` capability, which states the corpus. A `data` artifact's title SHALL keep its file extension, for example `asyncapi.yaml`, and a `diagram` artifact's title SHALL keep its own on the same terms, for example `flow.mmd`. The title is therefore unambiguous, and it does not duplicate a same-stem markdown tab. The returned `ChangeDetail` SHALL continue to include the same `createdDate` and `archivedDate` fields as `ChangeInfo`, sourced from the same locations (`.openspec.yaml` frontmatter and archive folder name prefix respectively). `ChangeInfo` SHALL continue to expose lightweight presence flags so list views need not read full artifact content.

A `diagram` artifact is a distinct kind rather than a `data` artifact with a different extension. The two
answer different questions about the same file: `data` says *show me this file's text*, and `diagram`
says *show me what this file describes*. Classifying diagram source as data would make the viewer's only
possible answer the one the author wrote the file to avoid.

Adding a root kind SHALL remain a single classification change. Discovery, the artifact count, the change
directory's modification time and every host's search file set SHALL continue to derive from the one
classifier, so that a kind which is shown as a tab cannot be missed by the count or by search.

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

#### Scenario: Change with a non-markdown artifact
- **WHEN** scanner reads a change directory containing proposal.md and asyncapi.yaml
- **THEN** the returned `artifacts` array includes a markdown artifact for the proposal and a `data` artifact for the AsyncAPI file
- **AND** the `data` artifact is titled `asyncapi.yaml` and carries its raw text as content

#### Scenario: Change with a diagram artifact
- **WHEN** scanner reads a change directory containing design.md and flow.mmd
- **THEN** the returned `artifacts` array includes a markdown artifact for the design and a `diagram` artifact for the flow file
- **AND** the `diagram` artifact is titled `flow.mmd` and carries its raw text as content

#### Scenario: Both diagram extensions are discovered
- **WHEN** a change directory contains `a.mmd` and `b.mermaid` at its root
- **THEN** both are discovered as `diagram` artifacts

#### Scenario: Change metadata file is not an artifact
- **WHEN** scanner reads a change directory whose only non-markdown file at the root is `.openspec.yaml`
- **THEN** the returned `artifacts` array contains no `data` artifact for it (dotfiles are excluded)

#### Scenario: Non-markdown files in subdirectories are not surfaced
- **WHEN** a change directory contains a `.json` file inside a subdirectory other than the `specs/` tree
- **THEN** that file is not discovered as an artifact (root-only discovery)

#### Scenario: A diagram file in a subdirectory is not surfaced
- **WHEN** a change directory contains a `.mmd` file inside a subdirectory other than the `specs/` tree
- **THEN** that file is not discovered as an artifact (root-only discovery)

#### Scenario: Data artifact is counted like other artifacts
- **WHEN** a change contains proposal.md and one `.yaml` data file
- **THEN** the artifact count exposed on `ChangeInfo` counts both, matching the number of tabs shown in the detail view

#### Scenario: Diagram artifact is counted like other artifacts
- **WHEN** a change contains proposal.md and one `.mmd` diagram file
- **THEN** the artifact count exposed on `ChangeInfo` counts both, matching the number of tabs shown in the detail view

#### Scenario: A diagram file participates in the change's modification time
- **WHEN** the only file edited in a change directory is its `.mmd` file
- **THEN** the change's reported modification time reflects that edit
