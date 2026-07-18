## MODIFIED Requirements

### Requirement: JCEF webview initialization
The plugin SHALL create a JCEF browser component within the Tool Window that loads the React SPA frontend. The JCEF browser SHALL be initialized with the built-in server URL pointing to the embedded frontend resources. When JCEF is not available, the plugin SHALL fall back to external browser mode.

#### Scenario: Webview loads successfully
- **WHEN** the Tool Window is opened and JCEF is supported
- **THEN** the JCEF browser SHALL load the React SPA from the built-in server
- **AND** the dashboard page SHALL be displayed

#### Scenario: JCEF not available
- **WHEN** the IDE environment does not support JCEF (e.g., Android Studio)
- **THEN** the Tool Window SHALL display a fallback status panel with an "Open in Browser" button
- **AND** the plugin SHALL automatically open the spek Web UI in the user's default external browser
