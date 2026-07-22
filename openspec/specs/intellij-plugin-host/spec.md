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
The plugin SHALL register a Tool Window with id `spek` that appears in the IDE's right sidebar. The Tool Window SHALL display a vertical split pane whose bottom component is always the JCEF webview content (or external browser fallback), and whose top component is the OpenSpec tree navigator, present subject to the project's persisted tree visibility preference. When the tree navigator is hidden, the webview content SHALL occupy the whole Tool Window.

#### Scenario: Tool Window visibility
- **WHEN** a project with OpenSpec content is detected
- **THEN** a "spek" Tool Window icon SHALL appear in the right sidebar
- **AND** clicking the icon SHALL open/reveal the Tool Window with the webview

#### Scenario: Tool Window with the tree navigator visible
- **WHEN** the project's persisted tree visibility preference is "visible", or no preference is stored
- **AND** the spek Tool Window is opened
- **THEN** the Tool Window SHALL display both the tree navigator and the webview, separated by a draggable divider

#### Scenario: Tool Window with the tree navigator hidden
- **WHEN** the project's persisted tree visibility preference is "hidden"
- **AND** the spek Tool Window is opened
- **THEN** the Tool Window SHALL display only the webview, occupying the full Tool Window
- **AND** the tree navigator SHALL be reachable again via the Tool Window's visibility toggle

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

### Requirement: Tool Window construction survives an unavailable embedded browser
Creating the Tool Window content SHALL NOT fail because the embedded browser cannot be created. On every supported IDE
build, the Tool Window SHALL be constructed and populated regardless of whether JCEF is present, and no exception or
error originating from the embedded browser may escape Tool Window content creation.

#### Scenario: JCEF unavailable on a supported IDE
- **WHEN** the Tool Window is opened on a supported IDE build where JCEF cannot be resolved or is unsupported
- **THEN** the Tool Window SHALL be created with the tree navigator and the external-browser fallback panel
- **AND** no IDE Internal Error SHALL be reported

#### Scenario: JCEF available on a supported IDE
- **WHEN** the Tool Window is opened on a supported IDE build where JCEF is available
- **THEN** the Tool Window SHALL display the embedded webview, not the fallback panel
- **AND** theme synchronization and tree-driven navigation SHALL operate against the embedded webview
