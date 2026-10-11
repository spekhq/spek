## Purpose

在 IntelliJ sidebar 提供 specs TreeView，每個 spec 可展開其 h2/h3 heading 並跳至對應錨點。

## Requirements

### Requirement: Specs tree listing
The IntelliJ plugin SHALL display a folder tree of all specs from the OpenSpec repository. Folder and spec items SHALL be sorted within each folder by comparing one path segment at a time by UTF-16 code unit, matching the web and VS Code trees; each spec item SHALL show its final topic path segment, carry its full topic path as its tooltip, and retain its full topic path for navigation. A folder with its own spec SHALL remain openable while also expanding to child topics.

#### Scenario: Display specs list
- **WHEN** the user opens the spek Tool Window
- **THEN** a "Specs" root node displays all spec topics grouped by their path segments

#### Scenario: Parent spec with child topic
- **WHEN** `contracts/pagination` has its own spec and child topic `contracts/pagination/streaming-search`
- **THEN** both specs appear in the tree and the parent remains openable and expandable
- **AND** hovering the child item, labelled `streaming-search`, shows `contracts/pagination/streaming-search`

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
When the user double-clicks a tree item, the plugin SHALL navigate the JCEF webview to the corresponding page. If JCEF is not available, the plugin SHALL open the external browser with the corresponding URL. A spec item SHALL navigate by its full topic path, with each path segment encoded; a folder-only grouping node SHALL NOT open a spec.

#### Scenario: Double-click spec item with JCEF available
- **WHEN** JCEF is available
- **AND** the user double-clicks a spec item with topic "user-auth"
- **THEN** the JCEF webview navigates to `/specs/user-auth`

#### Scenario: Double-click nested spec item
- **WHEN** JCEF is available
- **AND** the user double-clicks the spec item for `contracts/pagination/streaming-search`
- **THEN** the JCEF webview navigates to `/specs/contracts/pagination/streaming-search`

#### Scenario: Double-click folder-only node
- **WHEN** the user double-clicks a grouping node that has no spec of its own
- **THEN** no navigation occurs

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
The tree SHALL automatically refresh when files under the `openspec/` directory are created, modified, or deleted, provided the tree panel is visible. Refresh SHALL be debounced to avoid excessive updates. When the tree panel is hidden, refreshes SHALL be deferred as described in the "Deferred tree refresh while hidden" requirement.

#### Scenario: New spec added
- **WHEN** a new spec directory with `spec.md` is created under `openspec/specs/`
- **THEN** the Specs tree refreshes to include the new spec item

#### Scenario: Change deleted
- **WHEN** a change directory is deleted under `openspec/changes/`
- **THEN** the Changes tree refreshes to remove the deleted change item

#### Scenario: Rapid file changes
- **WHEN** multiple file changes occur within 500ms
- **THEN** the tree refreshes only once after the debounce period

#### Scenario: File change while the tree is hidden
- **WHEN** the tree panel is hidden
- **AND** a file under `openspec/` changes
- **THEN** the tree does not refresh immediately
- **AND** the refresh happens when the tree panel is next shown

### Requirement: Split pane layout
The Tool Window SHALL use a vertical split pane with the tree panel on top and the webview (or fallback) panel on bottom. The user SHALL be able to resize the split ratio by dragging the divider, and the chosen ratio SHALL be persisted so it is restored the next time the Tool Window is created. When the tree panel is hidden, the webview panel SHALL occupy the full Tool Window and no divider SHALL be shown.

#### Scenario: Default layout
- **WHEN** the spek Tool Window is first opened
- **THEN** the tree panel occupies the upper portion and the webview panel occupies the lower portion of the Tool Window

#### Scenario: Resize split
- **WHEN** the user drags the split pane divider
- **THEN** the tree and webview panels resize accordingly

#### Scenario: Split ratio is restored
- **WHEN** the user drags the divider to a new position
- **AND** later reopens the project
- **THEN** the divider is restored to the position the user chose, not to the default ratio

#### Scenario: Layout with the tree hidden
- **WHEN** the tree panel is hidden
- **THEN** the webview panel occupies the full height of the Tool Window
- **AND** no divider is rendered

### Requirement: Tree panel visibility toggle
The IntelliJ plugin SHALL provide a toggle control that shows and hides the tree panel within the spek Tool Window. The control SHALL be exposed in two places, both backed by the same toggled state: an always-visible icon button in the Tool Window title bar, and a labelled, check-marked entry in the Tool Window's gear (⋮) menu. Toggling from either place SHALL take effect immediately, without rebuilding or reloading the webview panel.

#### Scenario: Hide the tree from the title bar
- **WHEN** the tree panel is visible
- **AND** the user clicks the toggle button in the spek Tool Window title bar
- **THEN** the tree panel is hidden
- **AND** the webview panel occupies the full height of the Tool Window
- **AND** the webview does not reload

#### Scenario: Show the tree from the title bar
- **WHEN** the tree panel is hidden
- **AND** the user clicks the toggle button in the spek Tool Window title bar
- **THEN** the tree panel is shown above the webview panel

#### Scenario: Toggle from the gear menu
- **WHEN** the user opens the spek Tool Window gear (⋮) menu
- **THEN** an entry labelled "Show Specs and Changes Tree" is present
- **AND** its check mark reflects whether the tree panel is currently visible
- **AND** selecting it toggles the tree panel's visibility

#### Scenario: Toggle state reflects current visibility
- **WHEN** the tree panel is visible
- **THEN** the title bar toggle button renders in its selected (pressed) state

### Requirement: Tree visibility preference persistence
The plugin SHALL persist the tree panel's visibility per project, so the choice survives closing and reopening the project and restarting the IDE. The preference SHALL be stored in the project's workspace file, not in a version-controlled project file. When no stored preference exists, the tree panel SHALL default to visible.

#### Scenario: Hidden tree stays hidden across restarts
- **WHEN** the user hides the tree panel
- **AND** closes the project and reopens it
- **THEN** the tree panel is hidden
- **AND** the webview panel occupies the full height of the Tool Window

#### Scenario: Visible tree stays visible across restarts
- **WHEN** the user shows the tree panel
- **AND** restarts the IDE
- **THEN** the tree panel is visible

#### Scenario: No stored preference
- **WHEN** a project has never had the toggle used
- **THEN** the tree panel is visible

#### Scenario: Preference is scoped to the project
- **WHEN** the user hides the tree panel in project A
- **AND** opens project B, which also contains OpenSpec content
- **THEN** the tree panel in project B is visible

#### Scenario: OpenSpec detection is not persisted
- **WHEN** a project that previously contained an `openspec/` directory has it removed
- **AND** the project is reopened
- **THEN** the plugin SHALL re-detect the absence of OpenSpec content rather than reading a persisted value

### Requirement: Deferred tree refresh while hidden
While the tree panel is hidden, the plugin SHALL NOT rebuild the tree model in response to file changes; it SHALL instead record that a refresh is pending. When the tree panel becomes visible and a refresh is pending, the plugin SHALL rebuild the tree model before displaying it, so the tree is never shown stale. When the tree panel is hidden at Tool Window creation, the plugin SHALL skip the initial tree model build entirely. Visibility state SHALL be readable from the file-watcher thread without touching Swing component state.

#### Scenario: File change while tree is hidden
- **WHEN** the tree panel is hidden
- **AND** a file under `openspec/` is created, modified, or deleted
- **THEN** the tree model is not rebuilt
- **AND** a pending refresh is recorded

#### Scenario: Showing a tree with a pending refresh
- **WHEN** the tree panel is hidden and a refresh is pending
- **AND** the user shows the tree panel
- **THEN** the tree model is rebuilt
- **AND** the displayed tree reflects the current contents of `openspec/`

#### Scenario: Showing a tree with no pending refresh
- **WHEN** the tree panel is hidden and no file changed while it was hidden
- **AND** the user shows the tree panel
- **THEN** the tree model is not rebuilt

#### Scenario: Tool Window opens with the tree hidden
- **WHEN** the stored preference is "hidden"
- **AND** the spek Tool Window is created
- **THEN** the initial tree model build is skipped
- **AND** no `openspec/` directory scan is performed for the tree

#### Scenario: File change while tree is visible
- **WHEN** the tree panel is visible
- **AND** a file under `openspec/` is created, modified, or deleted
- **THEN** the tree refreshes as before
