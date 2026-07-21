## Purpose

Keep the IntelliJ plugin usable when JCEF is unavailable, by opening the spek Web UI in the user's default external browser.

## Requirements

### Requirement: External browser launch
When JCEF is not available, the plugin SHALL open the spek Web UI in the user's default external browser using the IntelliJ Built-in Server URL.

#### Scenario: Auto-launch on Tool Window open
- **WHEN** the Tool Window is created and JCEF is not supported
- **THEN** the plugin SHALL wait for the Built-in Server API to be ready
- **AND** the plugin SHALL open the external browser with the URL `http://localhost:{port}/spek/webview/index.intellij.html?projectPath={encodedPath}&apiBase=http://localhost:{port}/api/spek&theme={theme}`

#### Scenario: Manual re-launch via button
- **WHEN** the user clicks the "Open in Browser" button in the Tool Window
- **THEN** the plugin SHALL open the external browser with the same URL

### Requirement: Fallback status panel
When JCEF is not available, the Tool Window SHALL display a Swing-based status panel instead of a blank or error-only view.

#### Scenario: Panel content
- **WHEN** JCEF is not supported and the Tool Window is displayed
- **THEN** the panel SHALL show a message explaining that spek is running in external browser mode
- **AND** the panel SHALL include a button labeled "Open in Browser"

#### Scenario: Server not ready
- **WHEN** JCEF is not supported and the Built-in Server API is not yet ready
- **THEN** the panel SHALL show a loading or waiting message
- **AND** the browser SHALL NOT be launched until the API is confirmed ready
