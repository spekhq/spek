## Purpose

State once what search indexes, what counts as a match, which result a match produces, and in what order,
so that every surface spek ships — the web server, the VS Code host, the IntelliJ server, and the static
build — answers the same query over the same repository with the same results.

## Requirements

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

### Requirement: A match is a case-insensitive substring, with every runtime boundary stated

A document SHALL match a query when the query, lowercased, occurs as a substring of the document's text,
lowercased. A spec SHALL also match when the query occurs in its topic name **or in that name with `-` and
`_` runs rendered as single spaces**; a change SHALL also match when the query occurs in its slug or in the
same humanised form of it. The humanised form is what the reader is shown on a result, so a query copied
from a result SHALL find it.

The query SHALL be trimmed of leading and trailing whitespace before both the blankness test and the match.
A query that is empty or contains only whitespace SHALL produce no results.

Case folding SHALL use the locale-independent form on every surface, and SHALL be applied **one UTF-16
code unit at a time** rather than to the string as a whole. A locale-sensitive fold SHALL NOT be used:
under a Turkish default locale it maps `I` to `ı`, which would make the same repository answer differently
depending on the machine running the search.

Per-unit folding is required because whole-string folding is where the runtimes disagree — one maps `ß` to
`ss` and expands `İ` to two code units where the other does neither — and because it is length-preserving,
which the snippet rule below depends on. Agreement between implementations is guaranteed **exactly for
ASCII and best-effort beyond it**: a character outside the Basic Multilingual Plane carries no per-unit
mapping, and each runtime folds at its own Unicode version.

Comparisons that order documents or results SHALL use UTF-16 code-unit order. A locale-aware collation
SHALL NOT be used: it weakens punctuation, so `spec-diff` and `specdiff` order differently under it than
under code-unit order, and the two implementations would disagree.

Matching SHALL NOT be approximate. A query that does not occur verbatim SHALL produce no match, and a query
that does occur verbatim SHALL produce one wherever it sits in the document — a match SHALL NOT be weighted,
discarded, or ranked by its distance from the start of the text.

Unicode normalisation SHALL NOT be applied; text that differs only by normalisation form does not match,
consistently on every surface.

#### Scenario: A verbatim term deep in a document matches

- **WHEN** a spec's first 1000 characters do not contain `UNIQUETOKEN` and its last line does
- **THEN** searching `UNIQUETOKEN` returns that spec

#### Scenario: Case is ignored

- **WHEN** a document contains `SwitchUserToken` and the query is `switchusertoken`
- **THEN** the document matches

#### Scenario: Case folding does not depend on the host locale

- **WHEN** the same query and document are searched on a host whose default locale is `tr-TR` and on one whose default locale is `en-US`
- **THEN** both return the same results

#### Scenario: An approximate query does not match

- **WHEN** a document contains `aggregation` and the query is `agregation`
- **THEN** the document does not match

#### Scenario: A change matches on its own slug

- **WHEN** the query is a fragment of a change's slug and appears in none of its files
- **THEN** that change appears in the results

#### Scenario: A query copied from a result finds it again

- **WHEN** a result is titled `unified search semantics` and the reader searches that exact text
- **THEN** the change `unified-search-semantics` is returned

#### Scenario: Ordering does not use locale collation

- **WHEN** topics `spec-diff` and `specdiff` are both present
- **THEN** they are ordered by UTF-16 code unit, identically on every surface

#### Scenario: A blank query returns nothing

- **WHEN** the query is empty, only whitespace, or becomes empty after trimming
- **THEN** no results are returned

### Requirement: A spec or change yields at most one result, from the document that contains the query

Each spec and each change SHALL contribute at most one result. The result SHALL be taken from the first of
its documents whose **text** contains the query. Only where no document's text contains it — a topic or slug
match alone — SHALL the result be taken from the first document.

Selecting the first document that matches by any test SHALL NOT be done. A slug match makes every document
of that change match, so it would discard a real occurrence in a later document in favour of a snippet from
an earlier one containing nothing the reader typed, leaving a result the reader cannot see a reason for.

A term occurring in several of a change's files SHALL NOT list that change more than once.

Each result SHALL name the file the matching document came from, and SHALL carry whether the change is
active or archived, so a reader can tell which artifact answered and whether they are being offered
historical content.

#### Scenario: A term in three files lists the change once

- **WHEN** a query matches text in a change's `proposal.md`, `design.md` and `tasks.md`
- **THEN** exactly one result is returned for that change

#### Scenario: A textual occurrence wins over an earlier name-only match

- **WHEN** a query matches a change's slug and also occurs in the text of its `tasks.md` but in no earlier document
- **THEN** the result comes from `tasks.md`, and its snippet contains the query

#### Scenario: The result names its source file

- **WHEN** a result comes from a change's `design.md`
- **THEN** the result identifies `design.md` as the file the match came from

#### Scenario: An archived change is marked as archived

- **WHEN** a result is returned for an archived change
- **THEN** the result carries that status, distinguishable from an active change's result

### Requirement: Results follow a stated, deterministic order

Results SHALL be returned in a deterministic order that depends only on the repository's content: all
matching specs ordered by topic, then matching active changes ordered by slug, then matching archived
changes ordered by slug **descending**.

Archived slugs carry a `YYYY-MM-DD-` prefix and active slugs do not, the prefix being added at archive.
Descending order therefore puts the most recently archived change first, which is the direction every other
list in spek sorts; ascending order would make search the one view that leads with the oldest content it
holds. Active changes have no date to order by, so theirs is alphabetical.

Within a change, documents SHALL be ordered with the markdown and tasks files first, ordered by filename,
followed by the data files, ordered by filename. This order decides which document supplies a name-only
result, so a query matching only a change's slug SHALL be answered from a markdown artifact rather than
from a data file.

Results SHALL NOT be ordered by a relevance score. The same repository and the same query SHALL produce the
same results in the same order on every surface.

#### Scenario: Archived results lead with the newest

- **WHEN** archived changes dated 2026-02-13 and 2026-08-22 both match
- **THEN** the 2026-08-22 change is returned first

#### Scenario: A slug-only match previews prose, not data

- **WHEN** a change holds both `asyncapi.yaml` and `design.md`, and the query matches only its slug
- **THEN** the result's snippet comes from `design.md`

#### Scenario: Order is identical across surfaces

- **WHEN** the same query is run against the same repository through each surface spek ships
- **THEN** each returns the same results in the same order

### Requirement: Each result carries a snippet and a human-readable title

A result SHALL carry a snippet of up to 100 UTF-16 code units either side of the **first** occurrence of the
query in its document, marked at each end that was cut. The offset SHALL index the document's original
text; the length-preserving fold is what makes an offset found in the folded copy valid there, and a fold
that changed length would misalign every snippet after it. A cut SHALL NOT split a surrogate pair.
Where a result was produced by a topic or slug match with no occurrence in the text, the snippet SHALL be
the beginning of the document, capped at 200 code units.

A change result's title SHALL be the change's description with its `YYYY-MM-DD-` date prefix removed and
its hyphens rendered as spaces, by the same rule that titles a change everywhere else in spek. A spec
result's title SHALL be its topic.

#### Scenario: Snippet surrounds the first occurrence

- **WHEN** a query occurs twice in a document, 20 and 5000 characters in
- **THEN** the snippet surrounds the occurrence at 20 characters

#### Scenario: Snippet offsets survive a fold that changes length

- **WHEN** a document contains `İ` before the matched term
- **THEN** the snippet still surrounds the term, not text offset from it

#### Scenario: Snippet for a name-only match

- **WHEN** a change matches on its slug and on none of its text
- **THEN** the snippet is the head of its first document

#### Scenario: A change result is titled by its description

- **WHEN** a result is returned for the archived change `2026-09-10-unified-search-semantics`
- **THEN** its title is `unified search semantics`

#### Scenario: An active change has no date prefix to strip

- **WHEN** a result is returned for the active change `unified-search-semantics`
- **THEN** its title is `unified search semantics`

### Requirement: The rule is stated once and mirrored, not re-implemented per surface

The corpus rule, the match test, the result selection, the ordering, and the snippet rule SHALL be
implemented once in the core module and once in Kotlin, and every surface SHALL obtain its results from one
of those two implementations rather than from an implementation of its own.

The core implementation SHALL be reachable without loading any Node-only module, so that a browser bundle
serving a pre-embedded payload uses the same rule as a host that reads files.

The two implementations SHALL be verified against a **shared fixture corpus**: one file per case, holding
the documents, the query, and the expected results, read in full by the tests of both languages, so a case
added in one language is asserted by the other from its next run. Non-ASCII input in a fixture SHALL be
written as escapes rather than as literal characters, since a literal is silently rewritten on the way into
the file and guts the case it was added for. Non-ASCII cases SHALL be restricted to case mappings that have
been stable across Unicode releases, so the corpus does not turn a runtime upgrade into a red build with no
code change behind it.

Each loader SHALL reject a fixture that breaks the escaping rule. The two SHALL NOT be required to produce
the same rejection wording: holding two hand-copied message strings equal with nothing enforcing it is the
drift this corpus exists to prevent, and message parity is the job of a shared invalid-fixture corpus, which
this capability deliberately does not carry.

#### Scenario: Both implementations agree on every fixture

- **WHEN** the test suites of both languages run
- **THEN** each reads every fixture case and asserts the same expected results

#### Scenario: A new fixture case needs no second edit

- **WHEN** a case file is added to the shared corpus
- **THEN** both languages assert it without any further change to either test

#### Scenario: A malformed fixture is rejected by both loaders

- **WHEN** a fixture case is written with a literal non-ASCII character instead of an escape
- **THEN** each language's loader rejects it, each with its own wording

#### Scenario: The browser-safe path carries no Node dependency

- **WHEN** the rule is imported from a bundle that must not load `node:fs`
- **THEN** the import succeeds

### Requirement: Producing the corpus from files and from an embedded payload agree

A host that reads a repository from disk and a host that serves a pre-embedded payload SHALL produce the
same documents, in the same order, for the same change: the same files, each with the same text.

This is the one place the rule is necessarily written twice — a filesystem holds files, an embedded payload
holds records — so it SHALL be pinned by a test that compares the two producers over real content rather
than left to review.

#### Scenario: Both producers yield the same documents

- **WHEN** a change's documents are produced by reading its directory and by reading the embedded record built from that same directory
- **THEN** the two document lists are equal in count, order, filename and text

#### Scenario: Task text is searchable in an embedded payload

- **WHEN** a term appears only in the text of a task in a change's `tasks.md` and the corpus comes from an embedded payload
- **THEN** that change appears in the results
