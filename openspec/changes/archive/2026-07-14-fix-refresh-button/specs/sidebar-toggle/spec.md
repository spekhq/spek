## RENAMED Requirements

- FROM: `### Requirement: Collapsed sidebar Resync button`
- TO: `### Requirement: Collapsed sidebar Refresh button`

## MODIFIED Requirements

### Requirement: Sidebar collapse toggle button
The system SHALL display a toggle button at the bottom of the sidebar (above the Refresh button) that collapses or expands the sidebar. The button SHALL display a left-pointing chevron (`«`) when the sidebar is expanded and a right-pointing chevron (`»`) when collapsed.

#### Scenario: Toggle sidebar from expanded to collapsed
- **WHEN** the sidebar is expanded and the user clicks the toggle button
- **THEN** the sidebar collapses to 56px width showing only navigation icons

#### Scenario: Toggle sidebar from collapsed to expanded
- **WHEN** the sidebar is collapsed and the user clicks the toggle button
- **THEN** the sidebar expands to the full 240px width showing icons and labels

### Requirement: Collapsed sidebar Refresh button
The system SHALL display the Refresh button as icon-only in collapsed state, without the text label. Because the icon alone is the button's entire affordance in this state, it SHALL carry both a `title` attribute for the tooltip and an accessible name identifying it as Refresh.

#### Scenario: Refresh button in collapsed state
- **WHEN** the sidebar is collapsed
- **THEN** the Refresh button displays only its icon, with a tooltip reading "Refresh"
- **AND** the button exposes an accessible name of "Refresh" to assistive technology
