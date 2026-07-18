## MODIFIED Requirements

### Requirement: TreeView item navigation
When the user clicks a TreeView item, the extension SHALL open the spek Webview Panel and navigate to the corresponding page. If the Webview Panel is not yet open, the extension SHALL queue the navigation request and deliver it after the webview completes its ready handshake.

#### Scenario: Click spec item
- **WHEN** the user clicks a spec item with topic "user-auth"
- **THEN** the extension opens the spek webview panel and navigates to `/specs/user-auth`

#### Scenario: Click change item
- **WHEN** the user clicks a change item with slug "add-login"
- **THEN** the extension opens the spek webview panel and navigates to `/changes/add-login`

#### Scenario: Panel already open
- **WHEN** the webview panel is already open and the user clicks a TreeView item
- **THEN** the panel is revealed and navigated to the corresponding page without creating a new panel

#### Scenario: Panel not yet open - first click navigates correctly
- **WHEN** the webview panel is not open and the user clicks a TreeView item
- **THEN** the extension creates the panel, waits for the webview ready handshake, and navigates to the corresponding page in a single click
