## MODIFIED Requirements

### Requirement: Spec list with filtering
The system SHALL display all specs in a folder tree with history count metadata, with siblings ordered by comparing one path segment at a time by UTF-16 code unit, matching the VS Code and IntelliJ trees. A filter input SHALL allow instant client-side filtering by any part of the full topic path, retaining ancestor folders needed to reach matching specs. Each spec item SHALL show its topic's final path segment and the number of related changes as secondary information; its full topic path SHALL remain available to distinguish duplicate names.

#### Scenario: Display all specs
- **WHEN** user navigates to the SpecList page
- **THEN** all spec topics appear in a folder tree, ordered per segment by code unit within each folder, with each spec's history count, and every folder the reader has not collapsed is expanded

#### Scenario: Filter specs
- **WHEN** user types in the filter input
- **THEN** the tree shows only specs whose full topic path contains the text (case-insensitive), together with their ancestor folders

#### Scenario: Spec with no history
- **WHEN** a spec has zero related changes
- **THEN** the history count is not displayed (or shows "No changes")

#### Scenario: Parent spec with child specs
- **WHEN** a folder has its own `spec.md` and contains child spec folders
- **THEN** its spec remains openable and its child topics can be expanded

## ADDED Requirements

### Requirement: Spec tree folder controls
The spec list's folder tree SHALL label a folder that holds no spec of its own with its final path segment
alone, without a trailing path separator, SHALL keep its full topic path available to distinguish duplicate
names, and SHALL keep it visually distinct from a spec by not rendering it as a link. The tree SHALL remember
which folders the reader collapsed, per repository, across leaving and returning to the spec list and across
reloads where the host retains web storage; a folder the reader has not collapsed SHALL be shown expanded.
When the unfiltered tree contains at least one folder with children, the spec list SHALL offer controls to
expand every folder and to collapse every folder; these controls and the per-folder toggles SHALL be inert,
and SHALL appear inert, while the filter input has text. Stored state that cannot be read, cannot be parsed,
or is not a list of strings SHALL be treated as no folder collapsed.

#### Scenario: Folder label carries no separator
- **WHEN** a folder `process` holds child specs but no `spec.md` of its own
- **THEN** its row reads `process`, not `process/`, is not a link, and still exposes its full topic path

#### Scenario: Collapsed folders survive navigation
- **WHEN** the reader collapses `product` and `quality`, opens a spec under `process`, and returns to the spec list
- **THEN** `product` and `quality` are collapsed and `process` is expanded

#### Scenario: State is per repository
- **WHEN** the reader collapsed `product` in one repository and opens the spec list of another repository that also has a `product` folder
- **THEN** that repository's `product` folder is expanded

#### Scenario: New folders appear expanded
- **WHEN** a folder appears that did not exist when the reader last collapsed folders
- **THEN** it is shown expanded

#### Scenario: Collapse all and expand all
- **WHEN** the reader activates collapse all
- **THEN** every folder with children, including folders that hold their own spec, is collapsed, and the state is remembered
- **WHEN** the reader then activates expand all
- **THEN** every folder is expanded

#### Scenario: Flat spec list
- **WHEN** no spec folder has children
- **THEN** the expand-all and collapse-all controls are not shown

#### Scenario: Controls inert while filtering
- **WHEN** the filter input has text
- **THEN** every folder kept by the filter is expanded, the expand-all and collapse-all controls remain shown but disabled, and nothing the reader does to the tree changes the remembered state
- **WHEN** the filter input is cleared
- **THEN** the remembered collapsed folders are collapsed again

#### Scenario: Unreadable stored state
- **WHEN** web storage is unavailable, or the stored value for the repository is not a list of strings
- **THEN** every folder is shown expanded and the spec list remains usable
