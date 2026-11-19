## ADDED Requirements

### Requirement: Modified requirement comparison marks
In the Specs tab of a change whose status is active, the system SHALL compare each requirement under a delta
spec's `## MODIFIED Requirements` section with its base: the requirement of the same name inside the
`## Requirements` section of that delta spec's base — the main spec of the same topic in the working directory
the change was read from. Whether to compare SHALL be decided by the change's status, never by the presence of a
base field.

Both sources SHALL first have a leading byte order mark removed and every line ending normalised to `\n`. What is a
requirement and what is a scenario SHALL then be read as OpenSpec reads them, line by line, ignoring lines inside
fenced code blocks: a requirement starts at a `### Requirement:` header and runs to the next
`### Requirement:` header or `## ` header; its name is the header text after the keyword, trimmed, with a closing
`#` sequence removed, matched case-sensitively. A scenario is any `#### ` header inside a requirement and runs to
the next `#### ` header or the end of the requirement; its name is the header text with a closing `#` sequence and
a leading `Scenario:` (any case) removed, trimmed. A requirement's statement is its text after its header line and
before its first scenario; a scenario's text is its lines after its header line. Within one requirement, the k-th
scenario of a given name in the delta SHALL pair with the k-th scenario of that name in the base, in document
order; an unpaired delta scenario is new and an unpaired base scenario is dropped. A pair under the delta's
`## RENAMED Requirements` — a `FROM:` line and a `TO:` line each carrying a `### Requirement:` header — SHALL make
the modified requirement under its new name match the base requirement under its old name; when the base has no
requirement under the old name but has one under the new name (the rename was synced early), the new name SHALL be
used. Text SHALL be compared after removing trailing whitespace from each line and ignoring blank lines.

The comparison SHALL be shown as marks on the rendered delta, which otherwise SHALL remain as authored. A mark
SHALL be placed on the heading rendered from the source line it describes:
- a scenario with no same-named scenario in the base requirement SHALL be marked `new`;
- a scenario whose text differs from the same-named base scenario SHALL be marked `changed`;
- the names of base scenarios absent from the modified requirement SHALL be listed directly under the
  requirement's heading as dropped, rendered as code so no keyword highlighting applies to them, together with a
  note that OpenSpec refuses to archive a modification that drops scenarios;
- a requirement whose statement differs from the base statement SHALL be marked `changed`;
- a requirement whose statement and scenarios all equal the base's, with its scenarios in the same order, SHALL
  be marked `same as current spec` — or `renamed only` when it was matched through a rename pair under its old
  name;
- a modified requirement with no base requirement SHALL be marked `not in current spec`, and its scenarios SHALL
  carry no marks.

A source line that does not render as a heading, or a heading OpenSpec does not read as one, SHALL carry no mark.
Requirements under `## ADDED`, `## REMOVED` and `## RENAMED Requirements` SHALL carry no comparison marks. An
archived change SHALL carry no marks, because its main spec already contains it; when an archived change has a
modified requirement, the Specs tab SHALL state that comparison marks are shown for active changes only.

#### Scenario: A scenario added to a modified requirement
- **WHEN** an active change's delta modifies requirement `Search` with scenarios `A`, `B`, `C`, and the current spec's `Search` has `A` and `B` with identical text
- **THEN** scenario `C` is marked `new`, and `A` and `B` carry no mark

#### Scenario: A reworded scenario
- **WHEN** the modified requirement's scenario `B` has the same name as the current one but different text
- **THEN** `B` is marked `changed`

#### Scenario: Whitespace-only difference
- **WHEN** a scenario differs from the current one only in trailing whitespace or blank lines
- **THEN** it carries no mark

#### Scenario: A heading that is not Scenario-prefixed
- **WHEN** a modified requirement holds `#### Edge case`, which the current requirement does not
- **THEN** `Edge case` is marked `new`

#### Scenario: A level-3 heading inside a scenario
- **WHEN** a scenario's text continues under a `### Notes` heading before the next scenario
- **THEN** the `### Notes` text is compared as part of that scenario

#### Scenario: A dropped scenario
- **WHEN** the current requirement has scenario `D` and the modified requirement does not
- **THEN** `D` is listed as dropped directly under the requirement's heading, with the note that OpenSpec refuses to archive it

#### Scenario: A changed statement
- **WHEN** the modified requirement's text before its first scenario differs from the current requirement's
- **THEN** the requirement heading is marked `changed`

#### Scenario: Scenarios with the same name
- **WHEN** the current requirement has two scenarios named `A` and the modified requirement keeps only the first
- **THEN** the second `A` is listed as dropped, and the kept `A` is compared with the first

#### Scenario: Header spelling is not text
- **WHEN** a scenario reads `#### Scenario: A` in the current spec and `#### A` in the modification, with identical lines below
- **THEN** it carries no mark

#### Scenario: Reordered scenarios
- **WHEN** a modified requirement holds exactly the current scenarios, unchanged, in a different order
- **THEN** no scenario is marked, and the requirement is not marked `same as current spec`

#### Scenario: Renamed only
- **WHEN** the delta renames `Old name` to `New name` and modifies `New name` without changing its statement or scenarios
- **THEN** `New name` is marked `renamed only`

#### Scenario: Rename synced early
- **WHEN** the delta renames `Old name` to `New name`, and the current spec already has `New name` and no `Old name`
- **THEN** `New name` is compared with the current spec's `New name`

#### Scenario: Byte order mark
- **WHEN** a delta spec begins with a byte order mark followed by `## MODIFIED Requirements`
- **THEN** its modified requirements are compared and marked as without one

#### Scenario: A restated, unchanged requirement
- **WHEN** a modified requirement's statement and scenarios all equal the current requirement's
- **THEN** the requirement heading is marked `same as current spec`

#### Scenario: Renamed and modified
- **WHEN** the delta renames `Old name` to `New name`, modifies `New name`, and keeps `Old name`'s statement and scenario `A` unchanged while adding `B`
- **THEN** `New name` is not marked `not in current spec`, its statement is not marked `changed`, `A` carries no mark, and `B` is marked `new`

#### Scenario: No base requirement
- **WHEN** a modified requirement's name matches no requirement in the current spec's `## Requirements` section
- **THEN** the requirement is marked `not in current spec` and its scenarios carry no marks

#### Scenario: A topic with no main spec
- **WHEN** an active change modifies a requirement of a topic that has no main spec
- **THEN** each of its modified requirements is marked `not in current spec`

#### Scenario: Added requirements carry nothing
- **WHEN** a delta spec has a `## ADDED Requirements` section
- **THEN** no requirement or scenario in it carries a comparison mark

#### Scenario: Name written with markup
- **WHEN** a modified requirement's or scenario's name contains bold text, an escaped character or a code span
- **THEN** its mark is placed on the heading rendered from that line all the same

#### Scenario: Archived change
- **WHEN** the reader opens the Specs tab of an archived change that has a modified requirement
- **THEN** no comparison marks are shown, and the tab states that they are shown for active changes only

#### Scenario: Heading inside a code fence
- **WHEN** a modified requirement's body holds a fenced code block containing a line `#### Scenario: X`
- **THEN** that line is not read as a scenario
