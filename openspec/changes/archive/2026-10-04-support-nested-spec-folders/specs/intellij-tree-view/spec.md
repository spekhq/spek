# Spec Delta

## MODIFIED Requirements

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
