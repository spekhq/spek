# Spec Delta

## MODIFIED Requirements

### Requirement: The searchable corpus is a list of documents

Search SHALL run over a list of **documents**, where a document is the full text of one indexed file
together with the spec topic or change slug it belongs to.

The corpus SHALL contain exactly:

- one document per `openspec/specs/<topic>/spec.md`, and
- one document per **root artifact file** of every change — each root `*.md` (including `tasks.md`), each
  root `.yaml` / `.yml` / `.json`, and each root `.mmd` / `.mermaid` — for active and archived changes
  alike.

Entries whose name begins with `.` SHALL be skipped, whether a file or a directory, matching what the
scanner already excludes from discovery. A file with no content SHALL still contribute a document. Each
document SHALL hold one file's text and SHALL NOT be concatenated with another's: a query that spans the
boundary between two files matches neither.

The corpus SHALL NOT contain the change's delta `specs/` tree. A delta spec's content is reachable through
the main spec it changes, and indexing it lists the same text under two names.

Document membership SHALL be derived from the same root-file classification that decides which artifact
tabs a change shows, so an artifact that is displayed is an artifact that is searchable.

A diagram file is indexed as the **text it holds**, not as the picture drawn from it. The node labels an
author writes into a diagram are frequently the only place a term appears, and they are ordinary text in
the file; a search rule that matched the drawing would have to be a different rule on every host, which is
the one thing this capability exists to prevent.

#### Scenario: Every root artifact file contributes a document

- **WHEN** a change holds `proposal.md`, `design.md`, `tasks.md`, `brainstorm.md` and `asyncapi.yaml` at its root
- **THEN** the corpus holds one document for each of those five files

#### Scenario: A root diagram file contributes a document

- **WHEN** a change holds `flow.mmd` at its root whose text contains a term found nowhere else
- **THEN** searching that term returns a result for that change

#### Scenario: The delta specs tree is not indexed

- **WHEN** a change holds `specs/user-auth/spec.md` whose text contains a term found nowhere else
- **THEN** searching that term returns no result for that change

#### Scenario: Archived changes are indexed

- **WHEN** a term appears only in an archived change
- **THEN** that change appears in the results

#### Scenario: Dot entries are skipped

- **WHEN** a change directory holds `.scratch/notes.md` or a `.draft.md` at its root
- **THEN** neither contributes a document

#### Scenario: A query spanning two files matches neither

- **WHEN** a change's `design.md` ends with `alpha` and its `proposal.md` begins with `beta`
- **THEN** searching `alphabeta` returns no result for that change

#### Scenario: An empty file still contributes a document

- **WHEN** a change holds a zero-length `notes.md`
- **THEN** the corpus holds a document for it, with empty text
