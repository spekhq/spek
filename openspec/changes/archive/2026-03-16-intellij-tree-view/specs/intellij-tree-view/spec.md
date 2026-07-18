## ADDED Requirements

### Requirement: Specs tree listing
The IntelliJ plugin SHALL display a tree listing of all specs from the OpenSpec repository. Each item SHALL display the spec topic name. Items SHALL be sorted alphabetically.

#### Scenario: Display specs list
- **WHEN** the user opens the spek Tool Window
- **THEN** a "Specs" root node displays all spec topics sorted alphabetically

#### Scenario: Empty specs
- **WHEN** the project has an openspec directory with no specs
- **THEN** the Specs root node has no children

### Requirement: Changes tree listing
The IntelliJ plugin SHALL display a tree listing of changes from the OpenSpec repository, grouped by status. Each group SHALL display its change count. Each change item SHALL display the change slug name.

#### Scenario: Display changes with active and archived groups
- **WHEN** the project has both active and archived changes
- **THEN** the Changes root node displays two groups: "Active" and "Archived", each containing their respective change items sorted by date descending

#### Scenario: Display changes with only active changes
- **WHEN** the project has only active changes
- **THEN** the Changes root node displays only the "Active" group

#### Scenario: Empty changes
- **WHEN** the project has no changes
- **THEN** the Changes root node has no children

### Requirement: Tree item navigation to JCEF webview
When the user double-clicks a tree item, the plugin SHALL navigate the JCEF webview to the corresponding page. If JCEF is not available, the plugin SHALL open the external browser with the corresponding URL.

#### Scenario: Double-click spec item with JCEF available
- **WHEN** JCEF is available
- **AND** the user double-clicks a spec item with topic "user-auth"
- **THEN** the JCEF webview navigates to `/specs/user-auth`

#### Scenario: Double-click change item with JCEF available
- **WHEN** JCEF is available
- **AND** the user double-clicks a change item with slug "add-login"
- **THEN** the JCEF webview navigates to `/changes/add-login`

#### Scenario: Double-click item without JCEF
- **WHEN** JCEF is not available
- **AND** the user double-clicks a tree item
- **THEN** the plugin opens the external browser with the URL containing the target path as a hash fragment (e.g. `#/changes/some-slug`)
- **AND** the frontend reads the hash fragment as the initial route for MemoryRouter

#### Scenario: Webview not yet ready
- **WHEN** the user double-clicks a tree item before the webview has completed loading
- **THEN** the navigation request SHALL be queued and executed after the webview signals readiness

### Requirement: Tree auto-refresh on file changes
The tree SHALL automatically refresh when files under the `openspec/` directory are created, modified, or deleted. Refresh SHALL be debounced to avoid excessive updates.

#### Scenario: New spec added
- **WHEN** a new spec directory with `spec.md` is created under `openspec/specs/`
- **THEN** the Specs tree refreshes to include the new spec item

#### Scenario: Change deleted
- **WHEN** a change directory is deleted under `openspec/changes/`
- **THEN** the Changes tree refreshes to remove the deleted change item

#### Scenario: Rapid file changes
- **WHEN** multiple file changes occur within 500ms
- **THEN** the tree refreshes only once after the debounce period

### Requirement: Split pane layout
The Tool Window SHALL use a vertical split pane with the tree panel on top and the webview (or fallback) panel on bottom. The user SHALL be able to resize the split ratio by dragging the divider.

#### Scenario: Default layout
- **WHEN** the spek Tool Window is first opened
- **THEN** the tree panel occupies the upper portion and the webview panel occupies the lower portion of the Tool Window

#### Scenario: Resize split
- **WHEN** the user drags the split pane divider
- **THEN** the tree and webview panels resize accordingly
