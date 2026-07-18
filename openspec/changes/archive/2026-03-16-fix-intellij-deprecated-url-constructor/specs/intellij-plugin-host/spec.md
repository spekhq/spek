## MODIFIED Requirements

### Requirement: API readiness check
The plugin host SHALL check whether the Built-in Server API handler is ready before loading the webview. The readiness check SHALL use `URI(...).toURL().openConnection()` instead of the deprecated `URL(String)` constructor.

#### Scenario: API readiness check uses non-deprecated API
- **WHEN** the plugin starts and checks API readiness
- **THEN** the HTTP connection SHALL be created via `URI(checkUrl).toURL().openConnection()`
- **AND** no deprecated API usage warnings SHALL be reported by Plugin Verifier
