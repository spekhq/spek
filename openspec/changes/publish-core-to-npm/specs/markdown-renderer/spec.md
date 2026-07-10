## MODIFIED Requirements

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
