## Purpose

提供 changes 列表與單一 change 詳細檢視（proposal / design / tasks / specs 分頁），呈現 change 生命週期資訊。

## Requirements

### Requirement: Change list with active/archived separation
The system SHALL display changes grouped into active and archived sections. Active changes SHALL be visually distinguished with a left accent color border (4px). Changes SHALL be sorted by git timestamp descending (most recent first), falling back to slug date when timestamp is unavailable. Each change row SHALL display a compact lifecycle indicator based on `createdDate` and `archivedDate` (label words like "Created" / "Archived" are intentionally omitted to reduce visual noise; the meaning is conveyed by date format and the `→` separator):

- Active changes with `createdDate` SHALL display `<short-date> · <N>d`, where `<short-date>` is the locale-independent month-day form (e.g., `Apr 20`) and `<N>` is the integer day count between `createdDate` and today.
- Archived changes with both `createdDate` and `archivedDate` SHALL display `<short-date> → <short-date> · <N>d`, where `<N>` is the day count between the two dates.
- When `createdDate` is null, the system SHALL fall back to displaying the relative git timestamp (e.g., `2 days ago`) when a git timestamp is available, or the slug date in `YYYY-MM-DD` format otherwise.

The full ISO `createdDate`, `archivedDate`, and git timestamp (when available) SHALL be exposed as tooltip content on hover (the tooltip retains the full labels for clarity).

Where a row's whole card acts as the click target for the change, that target SHALL NOT suppress any
tooltip or other hover affordance the row carries. A card-wide target is implemented as an overlay
covering the row, and an overlay intercepts hover as well as clicks — so every element carrying a
tooltip has to be lifted above it explicitly. Nothing about the row's appearance changes when this
is missed: the tooltips simply stop appearing, on elements where they previously worked.

#### Scenario: Display active changes
- **WHEN** user navigates to the ChangeList page and there are active changes
- **THEN** active changes are listed in an "Active" section with a left accent color border, name, and task progress

#### Scenario: Display archived changes
- **WHEN** user navigates to the ChangeList page
- **THEN** archived changes are listed in an "Archived" section sorted by timestamp descending, without accent border

#### Scenario: Active change row shows lifecycle
- **WHEN** an active change has `createdDate: "2026-04-20"` and today is `2026-04-25`
- **THEN** the row displays `Apr 20 · 5d`
- **AND** hovering reveals the full ISO `createdDate` and git timestamp (when available) as tooltip content (with `Created:` / `First commit:` labels)

#### Scenario: Archived change row shows lifecycle span
- **WHEN** an archived change has `createdDate: "2026-02-14"` and `archivedDate: "2026-02-22"`
- **THEN** the row displays `Feb 14 → Feb 22 · 8d`
- **AND** hovering reveals full ISO `createdDate` and `archivedDate` as tooltip content (with `Created:` / `Archived:` labels)

#### Scenario: Tooltips survive a card-wide click target
- **WHEN** a row whose whole card opens the change carries a worktree badge, a jj status badge, and a lifecycle indicator, each with tooltip content
- **THEN** hovering any of them reveals its tooltip, and clicking the row anywhere not covered by them opens the change

#### Scenario: Change without createdDate falls back to timestamp
- **WHEN** a change has `createdDate: null` but a git timestamp is available
- **THEN** the row falls back to the relative git timestamp display (e.g., `2 days ago`)
- **AND** hovering reveals the full ISO timestamp as tooltip content

#### Scenario: Change without createdDate or timestamp
- **WHEN** a change has both `createdDate: null` and no git timestamp
- **THEN** the row falls back to displaying the slug date in `YYYY-MM-DD` format

#### Scenario: No changes
- **WHEN** there are no changes in the repo
- **THEN** system displays an empty state message

### Requirement: Change detail lifecycle banner
The change detail page (`/changes/:slug`) SHALL display a lifecycle banner directly below the change title and above the tab navigation bar. The banner leads with the lifecycle duration (the most actionable information) and follows with the supporting dates:

- Active changes (with `createdDate` and no `archivedDate`) SHALL display `Active for <N> days · since <ISO date>`, where `<N>` is the day count between `createdDate` and today. When the day count is 0 (created today), the banner SHALL display `Active for <1 day` instead of `Active for 0 days`.
- Archived changes (with both `createdDate` and `archivedDate`) SHALL display `Lifecycle <N> days · <ISO createdDate> → <ISO archivedDate>`, where `<N>` is the day count between the two dates. When the span is 0 (same-day archive), the banner SHALL display `Lifecycle <1 day` instead of `Lifecycle 0 days`.
- When `createdDate` is null, no lifecycle banner SHALL be rendered.

The banner SHALL be visually distinct from the title (smaller font size, muted text color) and SHALL be included in the sticky header region so it remains visible while scrolling.

#### Scenario: Active change banner
- **WHEN** user views a change with `createdDate: "2026-04-20"`, no `archivedDate`, and today is `2026-04-25`
- **THEN** the banner displays `Active for 5 days · since 2026-04-20`

#### Scenario: Archived change banner
- **WHEN** user views a change with `createdDate: "2026-02-14"` and `archivedDate: "2026-02-22"`
- **THEN** the banner displays `Lifecycle 8 days · 2026-02-14 → 2026-02-22`

#### Scenario: Same-day archive banner
- **WHEN** user views a change with `createdDate: "2026-04-21"` and `archivedDate: "2026-04-21"` (same-day archive)
- **THEN** the banner displays `Lifecycle <1 day · 2026-04-21 → 2026-04-21`

#### Scenario: Active change created today shows <1 day
- **WHEN** user views an active change with `createdDate: "2026-04-25"` and today is `2026-04-25`
- **THEN** the banner displays `Active for <1 day · since 2026-04-25`

#### Scenario: Change without createdDate
- **WHEN** user views a change whose `createdDate` is null
- **THEN** no lifecycle banner is rendered, and the title connects directly to the tab navigation bar as before

#### Scenario: Banner stays sticky on scroll
- **WHEN** the lifecycle banner is rendered and the user scrolls through long change content
- **THEN** the banner SHALL remain visible as part of the sticky header region (alongside the title and tab navigation bar)

### Requirement: Change detail with tab navigation
The system SHALL display change details using a tabbed interface whose tabs are generated from the change's discovered `artifacts` array, in the order that array provides (schema-enriched when available, otherwise the default `proposal, design, specs, tasks` ordering). Each tab's label SHALL be the artifact's title, and its content SHALL render according to the artifact's kind: `markdown` artifacts render their Markdown content, the `specs` artifact lists and renders its delta spec files, the `tasks` artifact renders structured task data with a TaskProgress bar, a `data` artifact renders its raw file content as a syntax-highlighted code block with the language inferred from the file extension, and a `diagram` artifact renders its content through the diagram capability — drawn where the surface draws, and as its source where it does not. A `data` tab SHALL NOT show a table of contents, because its content is not Markdown; a `diagram` tab SHALL NOT show one either, and SHALL NOT fold, on the same terms. Tab content SHALL transition with a fade-in animation when switching. The change title (including back navigation link) and tab navigation bar SHALL be sticky-positioned below the main header, remaining visible when the user scrolls through long content. The active tab SHALL be reflected in the URL `?tab=<artifact-id>` query parameter; when absent or unknown, the first artifact's tab SHALL be active.

A `diagram` tab SHALL offer the same access to its source that a diagram embedded in a document does. The
tab is a whole artifact rather than a block inside one, so the reader has nothing else on the tab to fall
back to if the drawing is unreadable, cannot be produced, or is not something this surface draws at all.

The tab's label SHALL distinguish a diagram artifact from a Markdown artifact of the same stem, on the
same terms the `data` tabs already use, so that `flow.mmd` beside a `flow.md` remains unambiguous.

#### Scenario: Tabs generated from artifacts
- **WHEN** a change's discovered artifacts are `proposal, design, specs, tasks`
- **THEN** the page renders tabs in that order with those titles

#### Scenario: Custom-schema tabs
- **WHEN** a change's discovered artifacts include `brainstorm, proposal, plan, verify` (a non spec-driven schema)
- **THEN** a tab is rendered for each artifact, in the discovered/enriched order, each showing that artifact's content

#### Scenario: View a markdown artifact tab
- **WHEN** user clicks a markdown artifact's tab
- **THEN** that artifact's Markdown content is displayed with a fade-in transition

#### Scenario: View specs tab
- **WHEN** user clicks the specs artifact's tab and the change has delta specs
- **THEN** the delta spec files are listed and their content displayed with a fade-in transition

#### Scenario: View tasks tab
- **WHEN** user clicks the tasks artifact's tab
- **THEN** the tasks content is displayed with a TaskProgress bar showing completion statistics, with a fade-in transition

#### Scenario: View a data artifact tab
- **WHEN** user clicks a `data` artifact's tab (for example `asyncapi.yaml`)
- **THEN** the artifact's raw file content is displayed as a syntax-highlighted code block with a fade-in transition, and no table of contents is shown

#### Scenario: View a diagram artifact tab
- **WHEN** user clicks a `diagram` artifact's tab (for example `flow.mmd`) on a surface that draws
- **THEN** the artifact is displayed as a drawn diagram with a fade-in transition, and no table of contents is shown

#### Scenario: A diagram tab on a surface that does not draw
- **WHEN** user clicks a `diagram` artifact's tab on a surface that does not draw
- **THEN** the artifact's source is displayed, and nothing indicates an error

#### Scenario: A diagram tab exposes its source
- **WHEN** a `diagram` artifact's tab is shown
- **THEN** the reader can display the artifact's Mermaid source and return to the drawn form

#### Scenario: A diagram tab that cannot be drawn
- **WHEN** a `diagram` artifact's content cannot be drawn
- **THEN** the tab shows that it could not be drawn, with the reported reason and the source, and the rest of the change detail page is unaffected

#### Scenario: A diagram tab beside a markdown tab of the same stem
- **WHEN** a change holds both `flow.md` and `flow.mmd`
- **THEN** the two tabs carry distinguishable labels

#### Scenario: Default and unknown tab query param
- **WHEN** the page loads with no `tab` query parameter, or a `tab` value that matches no artifact id
- **THEN** the first artifact's tab is active and no error is raised

#### Scenario: Sticky header on scroll
- **WHEN** user scrolls down through long change content
- **THEN** the change title (with back link) and tab navigation bar SHALL remain fixed below the main application header
- **AND** the sticky area SHALL have an opaque background that covers scrolling content beneath it

### Requirement: Task progress display in change detail
The Tasks tab SHALL display a progress bar and statistics (completed/total) derived from the change's task data.

#### Scenario: Show task progress
- **WHEN** viewing the Tasks tab of a change with tasks
- **THEN** a TaskProgress component shows a visual progress bar with "X / Y completed" text

### Requirement: Capability ID linking in proposal
The system SHALL render inline code elements in proposal markdown as navigable links when the code text matches an existing spec topic name.

#### Scenario: Capability ID matches existing spec
- **WHEN** a proposal markdown contains an inline code element (e.g., `` `responsive-layout` ``)
- **AND** a spec with the topic name `responsive-layout` exists
- **THEN** the inline code SHALL be rendered as a clickable link navigating to `/specs/responsive-layout`

#### Scenario: Inline code does not match any spec
- **WHEN** a proposal markdown contains an inline code element that does not match any existing spec topic
- **THEN** the inline code SHALL be rendered as a normal styled code element without a link

#### Scenario: MarkdownRenderer receives spec topics list
- **WHEN** MarkdownRenderer is used with a `specTopics` prop containing the list of available spec topic names
- **THEN** inline code matching any topic in the list SHALL be rendered as navigable links

### Requirement: Custom task checkbox styling
The system SHALL render task items in the Tasks tab using custom SVG icons instead of text-based `[x]`/`[ ]` markers. Completed tasks SHALL display a filled checkmark icon in green, and incomplete tasks SHALL display an empty circle icon. Completed task text SHALL be de-emphasised relative to an incomplete task's, in addition to the existing strikethrough styling.

The de-emphasis SHALL be carried by a colour from the theme's palette, and SHALL NOT be produced by opacity applied
to the task row. Opacity on the row composites every descendant toward the page — the body text, and also the links
and inline code spans a task's Markdown may contain, each of which sets its own colour — so no palette value can
compensate for it. Everything the row renders remains subject to the readability floor stated by `theme-toggle`,
including the checkmark icon, which is a graphical object carrying the completed state.

Task text SHALL be rendered as Markdown using the same CommonMark+GFM renderer as the rest of the
viewer, so inline formatting (emphasis, inline code, links) and a task's continuation lines display as
a standard Markdown renderer would show the same source. The rendering SHALL be limited to standard
Markdown: no spek-specific syntax extensions, and no BDD keyword highlighting or heading anchors in the
Tasks tab. A task with no continuation lines SHALL remain visually unchanged, its text sitting inline
with its checkbox icon.

#### Scenario: Incomplete task display
- **WHEN** a task item is not completed
- **THEN** the task displays an empty circle SVG icon followed by the task text at the primary text colour

#### Scenario: Completed task display
- **WHEN** a task item is completed
- **THEN** the task displays a green checkmark SVG icon followed by the task text with strikethrough and a de-emphasised text colour
- **AND** the row applies no opacity

#### Scenario: A completed task stays readable
- **WHEN** a completed task's text contains a link or an inline code span
- **AND** either theme is active
- **THEN** that link or code span still meets the readability floor stated by `theme-toggle`

#### Scenario: Inline formatting in task text
- **WHEN** a task's text contains `**bold**` or `` `code` ``
- **THEN** it renders as emphasized and inline-code styled content rather than literal asterisks and backticks

#### Scenario: Multi-line task display
- **WHEN** a task's text contains continuation lines
- **THEN** the full text is displayed, with sub-bullets rendered as a nested list where standard
  Markdown would render one

#### Scenario: Single-line task layout preserved
- **WHEN** a task's text is a single line
- **THEN** it renders inline beside its checkbox icon with no added block spacing

### Requirement: Change detail TOC sidebar
The change detail page (`/changes/:slug`) SHALL display a sticky table-of-contents (TOC) sidebar for the current tab when the active artifact is renderable as Markdown (kind `markdown` or `specs`), its heading count is at least 3, and the viewport width is at least 1280px. The `tasks` artifact tab SHALL never show a TOC because its content is structured rather than Markdown. Each TOC entry SHALL be a clickable link that smooth-scrolls the main content to the corresponding heading. `h3` entries SHALL be visually indented relative to `h2` entries.

#### Scenario: TOC visible on a markdown artifact with long content
- **WHEN** user views a change whose active markdown artifact contains 3 or more `h2`/`h3` headings on a viewport at least 1280px wide
- **THEN** a sticky TOC sidebar appears alongside the main content listing every `h2` and `h3` heading from that artifact in document order

#### Scenario: TOC visible on specs tab
- **WHEN** user switches to the specs artifact tab and the combined headings across all delta specs total 3 or more
- **THEN** the TOC sidebar lists every heading from every delta spec in the order the specs are rendered

#### Scenario: TOC hidden on tasks tab
- **WHEN** user switches to the tasks artifact tab
- **THEN** no TOC sidebar is rendered regardless of heading count, because tasks content is structured (non-markdown)

#### Scenario: TOC hidden for short markdown tab
- **WHEN** the active tab's content contains fewer than 3 `h2`/`h3` headings
- **THEN** no TOC sidebar is rendered and the main content occupies the full available width

#### Scenario: TOC hidden on narrow viewport
- **WHEN** user views a change on a viewport narrower than 1280px
- **THEN** the TOC sidebar is not rendered regardless of the active tab

#### Scenario: Click TOC entry
- **WHEN** user clicks a TOC entry while on a markdown or specs tab
- **THEN** the main content smooth-scrolls to the corresponding heading
- **AND** the URL hash updates to that heading's slug

### Requirement: Change detail TOC updates on tab switch
The TOC sidebar SHALL recompute its entries whenever the active tab changes, and SHALL apply scrollspy and hash-anchor behavior to the newly active tab's content.

#### Scenario: Tab switch recomputes headings
- **WHEN** user switches from Proposal to Design while a TOC is visible
- **THEN** the TOC entries update to reflect the Design tab's headings

#### Scenario: Tab switch clears previous hash
- **WHEN** user switches tabs by clicking the tab bar
- **THEN** the URL hash is cleared and only the new tab's query param remains

#### Scenario: Tab switch scrolls content to top
- **WHEN** user switches to a different tab
- **THEN** the main content resets to the top of the new tab's content

### Requirement: Change detail tab state persisted in URL
The change detail page SHALL reflect the active tab in the URL query string (`?tab=<tab-id>`), and SHALL restore the correct tab when the page loads with a `tab` query parameter. If no `tab` parameter is present, the Proposal tab SHALL be active by default.

#### Scenario: Tab selection updates URL
- **WHEN** user clicks a tab
- **THEN** the URL query string updates to `?tab=<id>` matching the clicked tab

#### Scenario: Load with tab query param
- **WHEN** user opens a URL such as `/changes/<slug>?tab=design`
- **THEN** the Design tab is active when the page renders

#### Scenario: Load without tab query param
- **WHEN** user opens `/changes/<slug>` with no `tab` query parameter
- **THEN** the Proposal tab is active by default

#### Scenario: Invalid tab query param falls back to default
- **WHEN** user opens a URL with an unknown `tab` value (e.g., `?tab=bogus`)
- **THEN** the Proposal tab is active and no error is raised

### Requirement: Change detail scrollspy
The change detail page SHALL highlight the TOC entry corresponding to the heading currently closest to the top of the viewport while the user scrolls the active markdown tab (scrollspy behavior). The threshold that decides whether a heading has been scrolled past SHALL be the same measured header bottom that hash-anchor scrolling uses, and the comparison SHALL tolerate a few pixels of rounding, so the heading a reader just scrolled to via the TOC is the one highlighted.

#### Scenario: Active entry on scroll
- **WHEN** user scrolls through a markdown tab's content while the TOC is visible
- **AND** a heading enters the top region of the viewport
- **THEN** the TOC entry matching that heading is visually highlighted as active

#### Scenario: Only one active entry
- **WHEN** multiple headings are simultaneously visible in the viewport
- **THEN** exactly one TOC entry is highlighted (the heading closest to the top)

#### Scenario: The clicked entry is the highlighted one
- **WHEN** the user clicks a TOC entry and the page finishes scrolling that heading to just below the sticky header
- **THEN** the clicked entry — not the one before it — is highlighted, whether the click started from the top of the page or mid-scroll

### Requirement: Change detail hash anchor navigation
The change detail page SHALL scroll to the heading matching the URL hash after the page loads or after the hash changes, once the active tab's markdown content finishes rendering. When a URL contains both `tab` query param and a hash, the page SHALL first activate the specified tab, then scroll to the hash-matching heading within that tab. The scroll SHALL position the target heading in the visible area **below** the sticky header (title + tab row), not at the literal viewport top where the header would obscure it. The offset SHALL be derived from the actual rendered sticky header at scroll time (falling back to the fixed app header, then a constant) rather than a fixed assumed height, so a taller-than-usual sticky header does not hide the target. The header SHALL be measured as it sits once pinned, so the offset does not drift with the reader's current scroll position.

#### Scenario: Direct link with tab and hash
- **WHEN** user opens a URL such as `/changes/<slug>?tab=design#decision-1`
- **THEN** the Design tab becomes active
- **AND** after the Design content renders, the page scrolls so the heading with slug `decision-1` sits fully visible just below the sticky header

#### Scenario: Direct link with hash but no tab param
- **WHEN** user opens `/changes/<slug>#some-heading` with no `tab` query param
- **THEN** the Proposal tab is active
- **AND** the page scrolls so the heading with slug `some-heading` in the Proposal content sits just below the sticky header

#### Scenario: Hash change while on page
- **WHEN** user clicks a TOC entry while viewing a markdown tab
- **THEN** the URL hash updates and the page scrolls so the target heading lands just below the sticky header within the current tab

#### Scenario: Tall sticky header does not obscure the target
- **WHEN** the sticky header is taller than a fixed 80px assumption (e.g. it carries worktree chips or a schema-fallback notice) and the user navigates to a heading
- **THEN** the heading lands below the measured header bottom and is not hidden behind it — the section clicked, not the next one, appears at the top of the readable area

#### Scenario: Hash with no matching heading
- **WHEN** the URL hash does not match any heading slug on the current tab
- **THEN** no scrolling occurs and the page renders at its default scroll position

### Requirement: Specs tab heading slug prefix
When the Specs tab renders multiple delta specs in a single change, each spec's heading ids SHALL be prefixed with the spec topic using the format `<topic>--<slug>` to prevent id collisions across specs. The slug SHALL continue to be derived from the heading's authored text, including any OpenSpec format keyword it carries, so that prefixing is the only difference between these ids and the spec detail page's.

The TOC entries SHALL display each heading as the Specs tab's content displays it — without the topic prefix, and without the OpenSpec format keyword where the content elides it — while the anchor links SHALL use the prefixed form. The elision SHALL apply to the Specs tab only: the TOC over a change's proposal or design artifact SHALL show heading text exactly as authored, because those artifacts are not spec-shaped and the tab a TOC is built from is what decides this, never the text of a heading.

#### Scenario: Distinct slugs across specs with duplicate heading
- **WHEN** a change's Specs tab contains two delta specs each with a `### Requirement: Foo`
- **THEN** the two resulting heading elements have distinct ids of the form `<topic-a>--requirement-foo` and `<topic-b>--requirement-foo`
- **AND** both appear in the TOC with label "Foo"

#### Scenario: TOC anchor uses prefixed slug
- **WHEN** user clicks a TOC entry for a heading in the Specs tab
- **THEN** the URL hash is set to the prefixed form `<topic>--<slug>` and the matching element scrolls into view

#### Scenario: A prose artifact's TOC is not elided
- **WHEN** user views the Proposal tab of a change whose proposal contains a heading reading `Requirement: Foo`
- **THEN** that TOC entry reads `Requirement: Foo`

#### Scenario: SpecDetail page slugs remain unprefixed
- **WHEN** user views a spec at `/specs/:topic`
- **THEN** the heading ids remain the original unprefixed slugs (behavior unchanged from the existing spec detail TOC)

### Requirement: Worktree source indicator on change rows
When the change list is showing aggregated results from more than one worktree, each change row SHALL display a compact indicator of its source worktree (the branch name, or a short worktree label when the worktree has a detached HEAD). When results come from a single worktree, no source indicator SHALL be shown.

#### Scenario: Source indicator under aggregation
- **WHEN** the change list shows changes aggregated from multiple worktrees
- **THEN** each change row displays its source worktree or branch

#### Scenario: No source indicator for single worktree
- **WHEN** the change list shows changes from a single worktree
- **THEN** no source indicator is rendered

### Requirement: Worktree-qualified change links
Under aggregation, a change row SHALL link to its detail page with a `wt` query parameter identifying its source worktree, so that same-slug changes from different worktrees resolve to the correct change. The change detail page SHALL read the `wt` query parameter and request the change from the matching worktree; when `wt` is absent it SHALL request the change from the currently selected directory, as before.

#### Scenario: Aggregated row links with wt parameter
- **WHEN** the user clicks an aggregated change row
- **THEN** the app navigates to `/changes/<slug>?wt=<key>` for that change's worktree

#### Scenario: Same-slug changes resolve independently
- **WHEN** two worktrees both have an active change `add-foo` and the user opens each from the list
- **THEN** each detail page shows the change content from its own worktree

#### Scenario: Detail page without wt parameter
- **WHEN** the user opens `/changes/<slug>` with no `wt` parameter
- **THEN** the change is read from the currently selected directory, as before this change

### Requirement: Specs tab folds delta spec content

The Specs tab SHALL render each delta spec with its requirements and scenarios folded on the same rules
as a spec detail view, and SHALL offer the same controls to expand and collapse every section.

A change's delta specs and the specs they modify are the same kind of document, so a reader who has
learned how one reads SHALL NOT meet a different presentation in the other. The change's other
artifacts — proposal, design, tasks — are unaffected and continue to render unfolded.

#### Scenario: Delta specs render folded

- **WHEN** the user opens a change's Specs tab and the change has delta specs
- **THEN** each delta spec's requirements are shown expanded and its scenarios are shown collapsed

#### Scenario: Bulk controls on the Specs tab

- **WHEN** the user activates expand all or collapse all while on the Specs tab
- **THEN** every section across all of the tab's delta specs changes accordingly

#### Scenario: Other artifact tabs are unaffected

- **WHEN** the user switches from the Specs tab to a markdown artifact tab such as proposal or design
- **THEN** that artifact's content renders unfolded

#### Scenario: TOC navigation into folded delta spec content

- **WHEN** the user activates a TOC entry for a heading inside a collapsed section of a delta spec
- **THEN** the enclosing sections are opened and the heading is scrolled into view

### Requirement: A delta spec's topic outranks the content it contains

Where the Specs tab renders several delta specs in one view, each spec's topic header SHALL be more
prominent than every heading belonging to that spec's own content, and SHALL NOT sit at a deeper level
of the document outline than the headings it encloses.

The topic header is the only thing telling a reader which spec they are looking at once several are
stacked. Presented below the rank of a grouping label repeated inside each spec, it stops performing
that job — the reader scrolls past a boundary without registering that one occurred.

#### Scenario: Topic header outranks the content's own headings

- **WHEN** the Specs tab renders a delta spec containing a `## ADDED Requirements` heading
- **THEN** the spec's topic header is rendered more prominently than that heading

#### Scenario: Topic header is not nested below its content in the outline

- **WHEN** the Specs tab renders a delta spec
- **THEN** the topic header's heading level is no deeper than the level of any heading in that spec's content

#### Scenario: Every stacked spec is bounded the same way

- **WHEN** the Specs tab renders two or more delta specs
- **THEN** each spec is introduced by its own topic header on identical terms, so each boundary between specs is marked

### Requirement: Change details preserve nested delta topics
The Specs tab SHALL include delta specs at any depth and display each one's full topic path. Topic links and heading anchors SHALL distinguish parent and child topics and same-named specs in different folders. Inline capability IDs in proposal text SHALL link to a spec only when the full ID matches an available main spec.

#### Scenario: Nested delta appears in Specs tab
- **WHEN** a change contains `specs/contracts/pagination/spec.md` and `specs/contracts/pagination/streaming-search/spec.md`
- **THEN** both delta specs appear with their distinct full topic headers

#### Scenario: Nested headings have distinct anchors
- **WHEN** two nested delta specs contain the same requirement heading
- **THEN** each TOC entry reaches the heading under its own full-topic-prefixed anchor

#### Scenario: Full capability ID in proposal links to spec
- **WHEN** proposal inline code contains `contracts/pagination/streaming-search` and that main spec exists
- **THEN** the inline code links to that spec's detail page

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
