## ADDED Requirements

### Requirement: JCEF webview initialization
The plugin SHALL create a JCEF browser component within the Tool Window that loads the React SPA frontend. The JCEF browser SHALL be initialized with the built-in server URL pointing to the embedded frontend resources.

#### Scenario: Webview loads successfully
- **WHEN** the Tool Window is opened
- **THEN** the JCEF browser SHALL load the React SPA from the built-in server
- **AND** the dashboard page SHALL be displayed

#### Scenario: JCEF not available
- **WHEN** the IDE environment does not support JCEF (e.g., remote development)
- **THEN** the Tool Window SHALL display a message indicating that JCEF is required

### Requirement: Frontend resource serving
The plugin SHALL serve the bundled React SPA resources (HTML, JS, CSS) through the IntelliJ built-in server. The resources SHALL be packaged within the plugin JAR under a dedicated path.

#### Scenario: Static resource loading
- **WHEN** the JCEF browser requests the frontend HTML page
- **THEN** the built-in server SHALL serve it from the plugin's bundled resources

#### Scenario: JavaScript and CSS loading
- **WHEN** the frontend HTML references JS and CSS assets
- **THEN** the built-in server SHALL serve these assets with correct MIME types

### Requirement: Theme synchronization
The plugin SHALL synchronize the IDE's current theme (light/dark) with the React SPA. Theme changes SHALL be reflected in real-time.

#### Scenario: Dark theme detection
- **WHEN** the IDE is using a dark theme (Darcula, Dark, etc.)
- **THEN** the plugin SHALL inject the `dark` CSS class on the webview's document root
- **AND** the React SPA SHALL render in dark mode

#### Scenario: Light theme detection
- **WHEN** the IDE is using a light theme
- **THEN** the plugin SHALL inject the `light` CSS class on the webview's document root

#### Scenario: Theme change at runtime
- **WHEN** the user switches IDE theme while the Tool Window is open
- **THEN** the plugin SHALL update the CSS class on the document root
- **AND** the React SPA SHALL re-render with the new theme

### Requirement: Project path injection
The plugin SHALL inject the current project's base path into the webview via URL query parameters (`projectPath`, `apiBase`, `theme`) so that the React SPA can read configuration synchronously at initialization.

#### Scenario: Project path available to frontend
- **WHEN** the JCEF webview loads
- **THEN** the plugin SHALL pass `projectPath`, `apiBase`, and `theme` as URL query parameters
- **AND** the React SPA SHALL read these values from `window.location.search` at initialization
- **AND** the FetchAdapter SHALL use `projectPath` as the directory query parameter

### Requirement: File change notification
The plugin SHALL watch the `openspec/` directory for file changes and notify the webview to refresh its data.

#### Scenario: File modified
- **WHEN** a file within `openspec/` is created, modified, or deleted
- **THEN** the plugin SHALL execute JavaScript in the JCEF browser to trigger a data refresh

#### Scenario: Debounced notifications
- **WHEN** multiple file changes occur in rapid succession
- **THEN** the plugin SHALL debounce notifications with a 500ms delay to avoid excessive refreshes

### Requirement: Navigation from IDE
The plugin SHALL support programmatic navigation within the webview, allowing IDE actions to navigate to specific specs or changes.

#### Scenario: Navigate to spec
- **WHEN** the plugin receives a navigation request for a specific spec topic
- **THEN** it SHALL execute JavaScript in the JCEF browser to navigate to `/specs/{topic}`

#### Scenario: Navigate to change
- **WHEN** the plugin receives a navigation request for a specific change slug
- **THEN** it SHALL execute JavaScript in the JCEF browser to navigate to `/changes/{slug}`
