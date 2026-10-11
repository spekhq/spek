# Spec Delta

## MODIFIED Requirements

### Requirement: Spec list with filtering
The system SHALL display all specs in a folder tree with history count metadata, with siblings ordered by comparing one path segment at a time by UTF-16 code unit, matching the VS Code and IntelliJ trees. A filter input SHALL allow instant client-side filtering by any part of the full topic path, retaining ancestor folders needed to reach matching specs. Each spec item SHALL show its topic's final path segment and the number of related changes as secondary information; its full topic path SHALL remain available to distinguish duplicate names.

#### Scenario: Display all specs
- **WHEN** user navigates to the SpecList page
- **THEN** all spec topics appear in a folder tree, ordered per segment by code unit within each folder, with each spec's history count

#### Scenario: Filter specs
- **WHEN** user types in the filter input
- **THEN** the tree shows only specs whose full topic path contains the text (case-insensitive), together with their ancestor folders

#### Scenario: Spec with no history
- **WHEN** a spec has zero related changes
- **THEN** the history count is not displayed (or shows "No changes")

#### Scenario: Parent spec with child specs
- **WHEN** a folder has its own `spec.md` and contains child spec folders
- **THEN** its spec remains openable and its child topics can be expanded

### Requirement: Spec detail display
The system SHALL display the full content of a spec when the user navigates to its detail page by full topic path. The content SHALL be rendered as Markdown, with its requirements and scenarios folded according to the spec section folding capability, and SHALL offer the controls to expand and collapse every section.

#### Scenario: View spec content
- **WHEN** user navigates to `/specs/contracts/pagination`
- **THEN** system displays topic `contracts/pagination` as the title and its full `spec.md` content as rendered Markdown

#### Scenario: Requirements and scenarios are folded
- **WHEN** the rendered spec contains requirement and scenario headings
- **THEN** each requirement is shown expanded and each scenario is shown collapsed, with controls available to expand or collapse all sections

#### Scenario: Spec not found
- **WHEN** user navigates to a spec topic that does not exist
- **THEN** system displays a "not found" message
