# Spec Delta

## MODIFIED Requirements

### Requirement: Specs TreeView
The sidebar SHALL display a TreeView containing all specs from the OpenSpec repository, grouped by their topic path segments and sorted alphabetically within each folder. Sibling ordering SHALL compare one path segment at a time by UTF-16 code unit. A folder with its own spec SHALL be both openable and expandable to its child topics. Each spec item SHALL remain expandable to reveal that spec's `h2` and `h3` headings as child nodes. When a spec item also has child topics, the child topics SHALL be listed first, then the spec's own headings in document order. Spec labels SHALL use the final path segment while the full topic remains available, as the item's tooltip, to distinguish duplicate names. Each heading child node SHALL display the heading text without the leading `## ` / `### ` markers and without the leading OpenSpec format keyword, matching the rendered content, and SHALL be visually distinguishable between `h2` and `h3` levels.

Each heading child node's tooltip SHALL carry the heading's authored text unchanged. The tooltip is where the sidebar already repeats the heading, so the authored form stays reachable in this host at no cost — but the tree is one surface among four, and this SHALL NOT be read as a requirement to invent a second, hidden rendering elsewhere.

Navigation SHALL be unaffected: each heading child node SHALL continue to command a jump to the heading's slug, which is derived from the authored text.

#### Scenario: Display specs list
- **WHEN** the user opens the spek sidebar
- **THEN** a "SPECS" section displays all spec topics in an alphabetically sorted folder tree, with spec items collapsed by default

#### Scenario: Expand spec to view headings
- **WHEN** the user expands a spec item
- **THEN** the spec's `h2` and `h3` headings are loaded and displayed as child tree items in document order

#### Scenario: Parent spec with child topic
- **WHEN** `contracts/pagination` has its own spec and child topic `contracts/pagination/streaming-search`
- **THEN** the parent spec can be opened and expanded to show the child topic
- **AND** the expanded parent lists `streaming-search` before the parent spec's own headings

#### Scenario: A requirement heading's label drops the format keyword
- **WHEN** the user expands a spec containing `### Requirement: Foo`
- **THEN** the child node's label reads `Foo`
- **AND** its tooltip reads `Requirement: Foo`

#### Scenario: Clicking a heading node still navigates
- **WHEN** the user clicks that child node
- **THEN** the webview navigates to `/specs/<topic>#<slug of the authored text>`, unchanged from before the label was elided

#### Scenario: Spec with no headings
- **WHEN** the user expands a spec item whose content has no `h2` or `h3` headings
- **THEN** the tree item shows no heading children and remains expandable without error

#### Scenario: h2 vs h3 visually distinguished
- **WHEN** a spec contains both `h2` and `h3` headings
- **THEN** the rendered child items make the level difference visually apparent (e.g., `h3` items are indented or marked differently from `h2` items)

#### Scenario: Empty specs
- **WHEN** the workspace has an openspec directory with no specs
- **THEN** the SPECS section displays a welcome message indicating no specs found

## ADDED Requirements

### Requirement: Nested spec navigation from VS Code
Spec and heading actions SHALL send the full topic path to the webview and preserve any heading hash, including when the panel is opened by that action.

#### Scenario: Open a nested spec heading
- **WHEN** the user selects a heading under `contracts/pagination/streaming-search`
- **THEN** the webview opens that spec and scrolls to the selected heading
