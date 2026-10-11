# Spec Delta

## MODIFIED Requirements

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
