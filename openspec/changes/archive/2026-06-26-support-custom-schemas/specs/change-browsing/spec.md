## MODIFIED Requirements

### Requirement: Change detail with tab navigation
The system SHALL display change details using a tabbed interface whose tabs are generated from the change's discovered `artifacts` array, in the order that array provides (schema-enriched when available, otherwise the default `proposal, design, specs, tasks` ordering). Each tab's label SHALL be the artifact's title, and its content SHALL render according to the artifact's kind: `markdown` artifacts render their Markdown content, the `specs` artifact lists and renders its delta spec files, and the `tasks` artifact renders structured task data with a TaskProgress bar. Tab content SHALL transition with a fade-in animation when switching. The change title (including back navigation link) and tab navigation bar SHALL be sticky-positioned below the main header, remaining visible when the user scrolls through long content. The active tab SHALL be reflected in the URL `?tab=<artifact-id>` query parameter; when absent or unknown, the first artifact's tab SHALL be active.

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

#### Scenario: Default and unknown tab query param
- **WHEN** the page loads with no `tab` query parameter, or a `tab` value that matches no artifact id
- **THEN** the first artifact's tab is active and no error is raised

#### Scenario: Sticky header on scroll
- **WHEN** user scrolls down through long change content
- **THEN** the change title (with back link) and tab navigation bar SHALL remain fixed below the main application header
- **AND** the sticky area SHALL have an opaque background that covers scrolling content beneath it

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
