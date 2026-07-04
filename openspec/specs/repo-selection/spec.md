## Purpose

讓 Web 版使用者選擇本地 repo 路徑並偵測其 openspec/ 目錄作為資料來源。

## Requirements
### Requirement: Path input with auto-detection
The system SHALL provide a text input for entering a filesystem path. Upon input, the system SHALL call the detect API to check for an `openspec/` directory and display the detection result.

#### Scenario: Valid path with openspec directory
- **WHEN** user enters a path that contains an `openspec/` directory
- **THEN** system displays a success indicator and a button to open the repo

#### Scenario: Valid path without openspec directory
- **WHEN** user enters a path that does not contain an `openspec/` directory
- **THEN** system displays a warning message indicating no openspec directory found

#### Scenario: Invalid path
- **WHEN** user enters a path that does not exist
- **THEN** system displays an error message

### Requirement: Directory browsing
The system SHALL provide a directory browser that calls the browse API, allowing users to navigate the filesystem and select a repo path.

#### Scenario: Browse directories
- **WHEN** user clicks the browse button
- **THEN** system displays a list of directories at the current path
- **AND** user can click a directory to navigate into it
- **AND** user can select the current directory as the repo path

### Requirement: Recent paths persistence
The system SHALL persist the most recent 5 repo paths in localStorage. On page load, previously used paths SHALL be displayed for quick selection. Each recent path SHALL be validated asynchronously against the detect API to show its current status (valid, invalid, or checking).

#### Scenario: Save path on successful detection
- **WHEN** user successfully opens a repo (path with valid openspec/)
- **THEN** the path is saved to localStorage recent paths list (max 5, most recent first)

#### Scenario: Display recent paths on load
- **WHEN** user visits the SelectRepo page
- **THEN** previously saved paths are displayed as clickable options

#### Scenario: Validate recent paths asynchronously
- **WHEN** the SelectRepo page loads with saved recent paths
- **THEN** the system calls the detect API for each path in parallel
- **AND** each path displays a status indicator: spinner (checking), green checkmark (valid openspec/ found), or red indicator (path invalid or no openspec/)

#### Scenario: Remove invalid path
- **WHEN** a recent path is determined to be invalid
- **THEN** a delete button appears next to the path allowing the user to remove it from the list

### Requirement: Auto-navigate to dashboard
The system SHALL automatically navigate to the Dashboard page after the user selects a valid repo path.

#### Scenario: Navigate after selection
- **WHEN** user selects a valid repo path (via input, browse, or recent paths)
- **THEN** system navigates to `/dashboard` with the repo path set in RepoContext

### Requirement: Auto-restore most recent repo on reload
On page load in the web application, if no repo has been selected yet in the current session, the system SHALL initialize the active repo path to the most recent entry from localStorage so that reloads and direct URL visits (e.g., `/specs/foo#bar`) stay on the requested page instead of redirecting back to the repo-selection screen.

#### Scenario: Reload on a spec detail page
- **WHEN** the user reloads the browser while on a spec detail URL and at least one recent path exists in localStorage
- **THEN** RepoContext initialises with the most recent path and the page continues to render without redirecting to `/`

#### Scenario: Direct visit to a URL with hash anchor
- **WHEN** the user opens a URL such as `/specs/foo#requirement-bar` directly in a new tab and at least one recent path exists in localStorage
- **THEN** RepoContext initialises with the most recent path, the spec detail page loads, and the hash anchor scrolls to the target heading

#### Scenario: No recent paths available
- **WHEN** the user opens any in-app URL and localStorage contains no recent paths
- **THEN** RepoContext remains empty and the user is redirected to the repo-selection page as before
