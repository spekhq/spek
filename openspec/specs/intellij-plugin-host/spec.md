## Purpose

定義 IntelliJ plugin 主體（Tool Window、專案偵測、生命週期），作為前端與 core 邏輯的宿主。

## Requirements

### Requirement: Plugin registration and lifecycle
The IntelliJ plugin SHALL register as a `com.intellij.openapi.project.Project`-level plugin with id `com.spek.intellij`. The plugin SHALL activate when a project is opened and deactivate when the project is closed.

#### Scenario: Plugin loads on project open
- **WHEN** a user opens a project in IntelliJ
- **THEN** the plugin initializes and checks for the presence of `openspec/` directory

### Requirement: OpenSpec project detection
The plugin SHALL detect the presence of OpenSpec content by checking for `openspec/config.yaml` or the existence of both `openspec/specs/` and `openspec/changes/` directories in the project root.

#### Scenario: Project with openspec/config.yaml
- **WHEN** the project root contains `openspec/config.yaml`
- **THEN** the plugin SHALL enable its Tool Window and make the "Open spek" action available

#### Scenario: Project with openspec directories only
- **WHEN** the project root contains `openspec/specs/` and `openspec/changes/` but no `config.yaml`
- **THEN** the plugin SHALL enable its Tool Window using fallback detection

#### Scenario: Project without openspec
- **WHEN** the project root contains no `openspec/` directory
- **THEN** the plugin SHALL not register its Tool Window and remain inactive

### Requirement: Tool Window registration
The plugin SHALL register a Tool Window with id `spek` that appears in the IDE's right sidebar. The Tool Window SHALL display a vertical split pane containing the OpenSpec tree navigator on top and the JCEF webview content (or external browser fallback) on the bottom.

#### Scenario: Tool Window visibility
- **WHEN** a project with OpenSpec content is detected
- **THEN** a "spek" Tool Window icon SHALL appear in the right sidebar
- **AND** clicking the icon SHALL open/reveal the Tool Window with both the tree navigator and the webview

### Requirement: Open spek action
The plugin SHALL register an action "Open spek" accessible from the Tools menu and via keyboard shortcut. The action SHALL open or reveal the spek Tool Window.

#### Scenario: Action invocation
- **WHEN** a user triggers the "Open spek" action
- **THEN** the spek Tool Window SHALL be opened and focused
- **AND** the webview SHALL navigate to the dashboard

### Requirement: Minimum IntelliJ version
The plugin SHALL support IntelliJ IDEA 2023.3 and later (since-build 233). The plugin SHALL be compatible with all IntelliJ Platform-based IDEs (IntelliJ IDEA, WebStorm, PyCharm, etc.).

#### Scenario: Supported IDE version
- **WHEN** the user runs IntelliJ IDEA 2023.3 or later
- **THEN** the plugin SHALL install and function correctly

#### Scenario: Unsupported IDE version
- **WHEN** the user runs an IDE version older than 2023.3
- **THEN** the plugin SHALL not be installable from the marketplace

### Requirement: API readiness check
The plugin host SHALL check whether the Built-in Server API handler is ready before loading the webview. The readiness check SHALL use `URI(...).toURL().openConnection()` instead of the deprecated `URL(String)` constructor.

#### Scenario: API readiness check uses non-deprecated API
- **WHEN** the plugin starts and checks API readiness
- **THEN** the HTTP connection SHALL be created via `URI(checkUrl).toURL().openConnection()`
- **AND** no deprecated API usage warnings SHALL be reported by Plugin Verifier
