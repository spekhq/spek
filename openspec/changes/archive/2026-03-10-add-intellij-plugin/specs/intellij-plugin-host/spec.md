## ADDED Requirements

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
The plugin SHALL register a Tool Window with id `spek` that appears in the IDE's right sidebar. The Tool Window SHALL display the JCEF webview content.

#### Scenario: Tool Window visibility
- **WHEN** a project with OpenSpec content is detected
- **THEN** a "spek" Tool Window icon SHALL appear in the right sidebar
- **AND** clicking the icon SHALL open/reveal the Tool Window with the webview

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
