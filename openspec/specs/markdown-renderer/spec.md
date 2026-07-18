## Purpose

渲染 OpenSpec markdown（含 GFM 與 BDD 語法高亮），統一各前端的內容呈現。

## Requirements

### Requirement: Markdown content rendering
The system SHALL render Markdown content using react-markdown with remark-gfm plugin, supporting GFM features including tables, strikethrough, and task lists.

#### Scenario: Standard Markdown rendering
- **WHEN** MarkdownRenderer receives a string containing standard Markdown (headings, lists, bold, italic, links, code blocks)
- **THEN** the content is rendered as formatted HTML with appropriate styling

#### Scenario: GFM table rendering
- **WHEN** MarkdownRenderer receives content containing a GFM pipe table
- **THEN** the table is rendered as a styled HTML table with header row and data rows

#### Scenario: GFM checkbox rendering
- **WHEN** MarkdownRenderer receives content containing `- [x]` or `- [ ]` items
- **THEN** the items are rendered as visual checkboxes (read-only)

### Requirement: BDD keyword highlighting
The system SHALL visually highlight BDD keywords in rendered Markdown content to improve readability of spec documents.

#### Scenario: WHEN/GIVEN keyword highlighting
- **WHEN** rendered Markdown contains the word `WHEN` or `GIVEN` as a standalone uppercase keyword
- **THEN** the keyword is displayed with a blue background label style (blue text on blue-tinted background)

#### Scenario: THEN keyword highlighting
- **WHEN** rendered Markdown contains the word `THEN` as a standalone uppercase keyword
- **THEN** the keyword is displayed with a green background label style (green text on green-tinted background)

#### Scenario: AND keyword highlighting
- **WHEN** rendered Markdown contains the word `AND` as a standalone uppercase keyword
- **THEN** the keyword is displayed with a gray background label style (gray text on gray-tinted background)

#### Scenario: MUST/SHALL keyword highlighting
- **WHEN** rendered Markdown contains `MUST` or `SHALL` as standalone uppercase keywords
- **THEN** the keywords are displayed in red bold text

#### Scenario: ADDED/MODIFIED badge rendering
- **WHEN** rendered Markdown contains `ADDED` or `MODIFIED` as standalone uppercase keywords
- **THEN** `ADDED` is displayed as an orange badge and `MODIFIED` is displayed as a blue badge

#### Scenario: Keywords inside code blocks are not highlighted
- **WHEN** BDD keywords appear inside inline code or fenced code blocks
- **THEN** the keywords are NOT highlighted and remain as plain code text

#### Scenario: Case-sensitive matching
- **WHEN** text contains lowercase or mixed-case variations like "when", "Then", "must"
- **THEN** the keywords are NOT highlighted (only exact uppercase matches trigger highlighting)

### Requirement: Dark theme styling
The system SHALL apply dark theme styles consistent with the application's design system (background #0a0c0f series, amber accent, text #e2e8f0).

#### Scenario: Code block styling
- **WHEN** MarkdownRenderer renders a fenced code block
- **THEN** the code block uses a dark background with monospace font and appropriate padding

#### Scenario: Link styling
- **WHEN** MarkdownRenderer renders a hyperlink
- **THEN** the link is displayed in accent color (amber) with hover effect

#### Scenario: Heading styling
- **WHEN** MarkdownRenderer renders headings (h1-h6)
- **THEN** headings use appropriate font sizes and weights consistent with the dark theme

### Requirement: Timestamp display format
All timestamps displayed in the UI SHALL use YYYY-MM-DD absolute date format consistently across all pages.

#### Scenario: Dashboard active changes
- **WHEN** the Dashboard displays an active change with a git timestamp
- **THEN** the timestamp is shown in YYYY-MM-DD format

#### Scenario: Dashboard archived changes
- **WHEN** the Dashboard displays an archived change with a git timestamp
- **THEN** the timestamp is shown in YYYY-MM-DD format

#### Scenario: ChangeList timestamps
- **WHEN** the ChangeList displays changes with git timestamps
- **THEN** all timestamps are shown in YYYY-MM-DD format

#### Scenario: SpecDetail history timestamps
- **WHEN** the SpecDetail page displays revision history entries
- **THEN** all timestamps are shown in YYYY-MM-DD format

#### Scenario: Fallback when no git timestamp
- **WHEN** a change or spec has no git timestamp but has a date field
- **THEN** the date field (already YYYY-MM-DD) is displayed as-is

### Requirement: Heading anchor ids
The MarkdownRenderer SHALL assign a deterministic, slug-based `id` attribute to every rendered `h2` and `h3` element so they can be targeted by URL hash anchors and TOC links. The slug for a heading SHALL match the slug produced by the shared `slugifyHeading` utility in `@spekjs/core`.

#### Scenario: h2 receives slug id
- **WHEN** MarkdownRenderer renders an `h2` heading with text `Requirement: Spec list with filtering`
- **THEN** the rendered `<h2>` element has `id="requirement-spec-list-with-filtering"`

#### Scenario: h3 receives slug id
- **WHEN** MarkdownRenderer renders an `h3` heading with text `Scenario: Display all specs`
- **THEN** the rendered `<h3>` element has `id="scenario-display-all-specs"`

#### Scenario: Duplicate heading text
- **WHEN** the same heading text appears twice in one document
- **THEN** the first occurrence uses the base slug and subsequent occurrences are suffixed with `-2`, `-3`, etc., matching the `extractHeadings` numbering

#### Scenario: Slug consistency with core utility
- **WHEN** any heading is rendered by MarkdownRenderer
- **THEN** its `id` exactly equals the `slug` produced by `extractHeadings(content)` from `@spekjs/core` for the same heading

### Requirement: List marker and content share a line
The MarkdownRenderer SHALL render every list item's marker (disc for `ul`, number for `ol`) on the same visual line as the start of that item's content, regardless of whether the list is tight (no blank lines between items) or loose (blank lines between items). Marker placement SHALL NOT depend on whether the item's content is wrapped in a block-level element.

#### Scenario: Loose bullet list keeps marker inline
- **WHEN** MarkdownRenderer renders a `ul` whose items are separated by blank lines (a loose list, so each item's content is wrapped in `<p>`)
- **THEN** each item's disc marker appears on the same line as the first line of that item's text
- **AND** no item renders its marker alone on a line above its content

#### Scenario: Tight bullet list keeps marker inline
- **WHEN** MarkdownRenderer renders a `ul` whose items have no blank lines between them
- **THEN** each item's disc marker appears on the same line as that item's text

#### Scenario: Loose ordered list keeps marker inline
- **WHEN** MarkdownRenderer renders an `ol` whose items are separated by blank lines
- **THEN** each item's number marker appears on the same line as the first line of that item's text

#### Scenario: Wrapped item text aligns under the first line
- **WHEN** a list item's text is long enough to wrap onto continuation lines
- **THEN** the continuation lines align with the first line's text, not under the marker

#### Scenario: Paragraphs within one item stay separated
- **WHEN** a single list item contains more than one paragraph
- **THEN** the gap between those paragraphs is greater than the gap between adjacent list items
- **AND** the paragraphs do not fuse into a single visual block

### Requirement: Task list items render a checkbox without a redundant marker
The MarkdownRenderer SHALL render GFM task list items (`- [ ]` / `- [x]`) with a checkbox as their only leading affordance, suppressing the list marker for those items. Marker suppression SHALL be scoped to the individual task item, not to its containing list, so that non-task items in the same list retain their normal marker. Non-task list items in the same document SHALL retain their normal marker. The `contains-task-list` and `task-list-item` class names emitted by remark-gfm SHALL be preserved on the rendered `ul` and `li` elements so the distinction is expressible in CSS.

#### Scenario: Mixed list keeps markers on its non-task items
- **WHEN** MarkdownRenderer renders a single list containing both task items and plain items, e.g. `- [x] a task`, `- a plain bullet`, `- [ ] another task`
- **THEN** each task item displays a checkbox and no marker
- **AND** the plain item still displays its disc marker rather than rendering as unmarked text

#### Scenario: Ordered task list suppresses its numbers
- **WHEN** MarkdownRenderer renders an ordered task list, e.g. `1. [ ] alpha` and `2. [x] beta` (which remark-gfm also marks with `contains-task-list`)
- **THEN** each item displays a checkbox and no number
- **AND** no number is rendered underneath or overlapping the checkbox

#### Scenario: Task list item shows no disc marker
- **WHEN** MarkdownRenderer renders content containing `- [ ] PASS` and `- [x] PASS WITH WARNINGS`
- **THEN** each item displays a read-only checkbox followed by its text
- **AND** no disc marker is displayed beside the checkbox

#### Scenario: remark-gfm class hooks reach the DOM
- **WHEN** MarkdownRenderer renders a GFM task list
- **THEN** the rendered `ul` element carries the `contains-task-list` class
- **AND** each task item's `li` element carries the `task-list-item` class

#### Scenario: Non-task lists keep their marker
- **WHEN** MarkdownRenderer renders a plain bullet list containing no checkboxes
- **THEN** each item still displays its disc marker

#### Scenario: Checkbox aligns with the item's first line
- **WHEN** a task list item's text wraps onto continuation lines
- **THEN** the checkbox aligns with the first line of the text rather than centering against the whole item

#### Scenario: Checkbox item containing a nested blockquote
- **WHEN** a task list item contains a nested blockquote beneath its text (as produced by custom schemas such as a retrospective's promote-candidates section)
- **THEN** the checkbox and the item's first line of text remain on the same line
- **AND** the nested blockquote renders beneath that text within the same list item

#### Scenario: Non-GFM deferred marker is not a task item
- **WHEN** MarkdownRenderer renders a line beginning with `- [~]`, which GFM does not parse as a task list item
- **THEN** the line renders as a normal list item whose text begins with the literal `[~]`
- **AND** the item retains its disc marker
