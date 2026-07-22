## Purpose

Define how the IntelliJ plugin declares its dependencies on platform APIs that may be extracted into
separate content modules across IDE versions, which declaration forms the supported build range permits, and what
evidence a compatibility-affecting change must produce before it is accepted.

## Requirements

### Requirement: Use of platform APIs that may live in extracted content modules
The plugin SHALL NOT assume a platform class stays reachable merely because it was reachable on an older build. The
IntelliJ Platform periodically extracts parts of its core into separate content modules with their own classloaders,
which makes previously visible classes invisible to a plugin that does not declare a dependency on them. For any such
platform API, the plugin SHALL either declare an explicit dependency on the providing module, or use the API in a way
that degrades gracefully when it cannot be resolved. Where a declaration form exists that is compatible with the whole
supported build range, the plugin SHALL both declare the dependency and keep the graceful degradation — the
declaration restores the feature on builds that have the module, and the degradation covers the builds and
circumstances where it is still unavailable.

#### Scenario: API is provided by a module the plugin can declare a dependency on
- **WHEN** the providing module can be depended on in a form satisfiable across the whole supported build range
- **THEN** the plugin SHALL declare that dependency so the feature works on builds that provide the module
- **AND** the plugin SHALL still detect unavailability at runtime and degrade rather than fail

#### Scenario: API used without a declared module dependency
- **WHEN** the plugin uses a platform API that is not covered by a declared dependency
- **THEN** the plugin SHALL detect the API's unavailability at runtime and continue with reduced functionality
- **AND** the plugin SHALL NOT surface an IDE Internal Error for that unavailability

#### Scenario: Platform extracts a module the plugin already uses
- **WHEN** a newer IDE build moves an in-use platform API into a content module the plugin does not depend on
- **THEN** the affected feature SHALL degrade to its documented fallback
- **AND** all other plugin features SHALL keep working

### Requirement: Declared dependencies must be satisfiable across the whole supported build range
The plugin SHALL NOT declare a mandatory dependency that cannot be satisfied on any IDE build within its supported
range (`since-build` and later), because an unsatisfied mandatory dependency prevents the plugin from loading at all.
A capability that exists only on newer builds SHALL be declared in an optional form, which is inert on builds where it
does not resolve, rather than being either declared mandatorily or given up on.

#### Scenario: Dependency available only on newer builds
- **WHEN** a required capability is provided by a plugin or module that exists only from a build newer than
  `since-build`
- **THEN** the plugin SHALL NOT declare it as a mandatory dependency of the main descriptor
- **AND** the plugin SHALL declare it optionally so that newer builds gain the capability
- **AND** the plugin SHALL degrade gracefully on the builds where it does not resolve

#### Scenario: Optional declaration does not affect older builds
- **WHEN** the plugin declares an optional dependency that does not resolve on an older supported build
- **THEN** the plugin SHALL still load on that build
- **AND** the unresolved dependency SHALL NOT be treated as a strict dependency

#### Scenario: Supported range is not silently narrowed
- **WHEN** a change modifies the plugin's dependency declarations
- **THEN** the plugin SHALL still load on the oldest build in its supported range

### Requirement: Evidence required for compatibility-affecting changes
A compatibility-affecting change SHALL be accepted only with evidence from an actual IDE run on the oldest supported
build, never from a successful compilation alone. A change is compatibility-affecting when it alters how the plugin
declares dependencies, or restructures code around a platform API's availability. The evidence SHALL confirm that the
feature still uses its primary implementation on that build rather than having silently fallen back.

#### Scenario: Verifying the oldest supported build
- **WHEN** a compatibility-affecting change is proposed
- **THEN** the plugin SHALL be run on an IDE at the oldest supported build with a project containing `openspec/`
- **AND** the Tool Window SHALL be confirmed to use the embedded webview rather than the fallback panel

#### Scenario: A build the change cannot be run on
- **WHEN** a supported build cannot be exercised in the development environment
- **THEN** the change SHALL state which builds are unverified and what evidence stands in for a real run
- **AND** claims about user-visible behavior on those builds SHALL NOT be presented as verified
