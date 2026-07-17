## ADDED Requirements

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
