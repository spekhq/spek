## ADDED Requirements

### Requirement: JCEF availability detection
The plugin SHALL determine JCEF availability at a single detection point that treats **any** `Throwable` raised while
probing as "JCEF is not available", including the `LinkageError` / `NoClassDefFoundError` raised when the JCEF classes
are not visible to the plugin's classloader. The detection SHALL record the reason in the IDE log at warning level.

JCEF and CEF types — `com.intellij.ui.jcef.*` and `org.cef.*`, which the platform ships as two separate content
modules — SHALL be confined to a dedicated class that is instantiated only after detection reports availability.
Neither package may appear in a field type or method signature of the detection code, or of the Tool Window panel that
consumes it, so that one class is the only place affected when the platform relocates either package.

#### Scenario: JCEF reports itself unsupported
- **WHEN** the JCEF probe returns false
- **THEN** detection SHALL report JCEF as not available

#### Scenario: JCEF classes are not visible to the plugin classloader
- **WHEN** the JCEF probe raises `NoClassDefFoundError` because the JCEF classes live in a platform content module the
  plugin does not depend on
- **THEN** detection SHALL report JCEF as not available
- **AND** detection SHALL NOT propagate the error to its caller
- **AND** the reason SHALL be written to the IDE log at warning level

#### Scenario: Probe fails in any other way
- **WHEN** the JCEF probe raises any other `Throwable`
- **THEN** detection SHALL report JCEF as not available

#### Scenario: JCEF is usable
- **WHEN** the JCEF probe returns true
- **THEN** detection SHALL report JCEF as available
- **AND** the plugin SHALL use the embedded webview rather than the fallback

## MODIFIED Requirements

### Requirement: External browser launch
The plugin SHALL open the spek Web UI in the user's default external browser using the IntelliJ Built-in Server URL
whenever JCEF is not available, as determined by JCEF availability detection — which includes the case where the JCEF
classes cannot be resolved at all.

#### Scenario: Auto-launch on Tool Window open
- **WHEN** the Tool Window is created and JCEF is not available
- **THEN** the plugin SHALL wait for the Built-in Server API to be ready
- **AND** the plugin SHALL open the external browser with the URL `http://localhost:{port}/spek/webview/index.intellij.html?projectPath={encodedPath}&apiBase=http://localhost:{port}/api/spek&theme={theme}`

#### Scenario: Manual re-launch via button
- **WHEN** the user clicks the "Open in Browser" button in the Tool Window
- **THEN** the plugin SHALL open the external browser with the same URL

#### Scenario: Navigation while in fallback mode
- **WHEN** the user selects an entry in the tree navigator and JCEF is not available
- **THEN** the plugin SHALL open the external browser with the same URL plus the target route as a `#` fragment

### Requirement: Fallback status panel
When JCEF is not available, the Tool Window SHALL display a Swing-based status panel instead of a blank or error-only
view. The panel's message SHALL NOT attribute the cause to the IDE's runtime, because the cause may equally be the
plugin's own missing dependency on a platform module.

#### Scenario: Panel content
- **WHEN** JCEF is not available and the Tool Window is displayed
- **THEN** the panel SHALL show a message explaining that spek is running in external browser mode
- **AND** the panel SHALL include a button labeled "Open in Browser"

#### Scenario: Server not ready
- **WHEN** JCEF is not available and the Built-in Server API is not yet ready
- **THEN** the panel SHALL show a loading or waiting message
- **AND** the browser SHALL NOT be launched until the API is confirmed ready
