## Purpose

Let users collapse and expand the navigation sidebar, and remember that choice across sessions.

## Requirements
### Requirement: Sidebar collapse toggle button
The system SHALL display a toggle button at the bottom of the sidebar (above the Refresh button) that collapses or expands the sidebar. The button SHALL display a left-pointing chevron (`«`) when the sidebar is expanded and a right-pointing chevron (`»`) when collapsed.

#### Scenario: Toggle sidebar from expanded to collapsed
- **WHEN** the sidebar is expanded and the user clicks the toggle button
- **THEN** the sidebar collapses to 56px width showing only navigation icons

#### Scenario: Toggle sidebar from collapsed to expanded
- **WHEN** the sidebar is collapsed and the user clicks the toggle button
- **THEN** the sidebar expands to the full 240px width showing icons and labels

### Requirement: Collapsed sidebar icon-only navigation
The system SHALL display navigation items as icon-only buttons when the sidebar is collapsed. Each navigation link SHALL display a corresponding icon: LayoutDashboard icon for Overview, FileText icon for Specs, and GitBranch icon for Changes. Each icon button SHALL include a `title` attribute showing the full link label.

#### Scenario: Display collapsed navigation with icons
- **WHEN** the sidebar is in collapsed state
- **THEN** navigation items display as icon-only buttons with tooltips

#### Scenario: Navigate from collapsed sidebar
- **WHEN** the user clicks a navigation icon in collapsed state
- **THEN** the app navigates to the corresponding route

#### Scenario: Active route indication in collapsed state
- **WHEN** the user is on the Specs page and sidebar is collapsed
- **THEN** the Specs icon is highlighted with the accent color

### Requirement: Collapsed sidebar Refresh button
The system SHALL display the Refresh button as icon-only in collapsed state, without the text label. Because the icon alone is the button's entire affordance in this state, it SHALL carry both a `title` attribute for the tooltip and an accessible name identifying it as Refresh.

#### Scenario: Refresh button in collapsed state
- **WHEN** the sidebar is collapsed
- **THEN** the Refresh button displays only its icon, with a tooltip reading "Refresh"
- **AND** the button exposes an accessible name of "Refresh" to assistive technology

### Requirement: Sidebar collapse state persistence
The system SHALL persist the sidebar collapse state to localStorage (key: `spek-sidebar-collapsed`) in the web version. On page load, the sidebar SHALL restore the previously saved state. In VS Code webview, the state SHALL default to expanded and not persist across sessions.

#### Scenario: Persist collapsed state in web version
- **WHEN** the user collapses the sidebar and refreshes the page
- **THEN** the sidebar remains collapsed after reload

#### Scenario: Default state in VS Code webview
- **WHEN** the webview is first opened
- **THEN** the sidebar is in expanded state

### Requirement: Sidebar transition animation
The system SHALL animate the sidebar width change and main content margin with a smooth CSS transition (200ms duration).

#### Scenario: Smooth collapse animation
- **WHEN** the user clicks the toggle button
- **THEN** the sidebar width and main content margin animate smoothly over 200ms

### Requirement: Mobile behavior unchanged
The sidebar toggle feature SHALL only apply to desktop viewports (768px and above). On mobile viewports, the existing overlay sidebar behavior SHALL remain unchanged.

#### Scenario: Mobile viewport ignores collapse state
- **WHEN** the viewport is below 768px
- **THEN** the sidebar uses the existing overlay behavior regardless of collapse state
