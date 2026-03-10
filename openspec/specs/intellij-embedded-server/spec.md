## Requirements

### Requirement: HTTP request handler registration
The plugin SHALL register an `HttpRequestHandler` with the IntelliJ built-in server to handle REST API requests under the path prefix `/api/spek/`. All API endpoints SHALL accept a `projectPath` query parameter to identify the target project.

#### Scenario: API endpoint routing
- **WHEN** the built-in server receives a request to `/api/spek/openspec/overview?projectPath=/path/to/project`
- **THEN** the handler SHALL route it to the overview handler and return JSON response

#### Scenario: Unknown endpoint
- **WHEN** the built-in server receives a request to `/api/spek/unknown`
- **THEN** the handler SHALL return HTTP 404

### Requirement: Overview endpoint
The server SHALL implement `GET /api/spek/openspec/overview` that returns specs count, changes count, and task statistics.

#### Scenario: Overview response
- **WHEN** `GET /api/spek/openspec/overview?projectPath=...` is called
- **THEN** it returns `{ specsCount, changesCount, taskStats: { total, completed } }`

### Requirement: Specs list endpoint
The server SHALL implement `GET /api/spek/openspec/specs` that returns a list of all specs with their topic names and descriptions.

#### Scenario: Specs list response
- **WHEN** `GET /api/spek/openspec/specs?projectPath=...` is called
- **THEN** it returns an array of `{ topic, title, description, updatedAt }` objects

### Requirement: Spec detail endpoint
The server SHALL implement `GET /api/spek/openspec/specs/:topic` that returns the full content of a single spec including its markdown content and history.

#### Scenario: Spec detail found
- **WHEN** `GET /api/spek/openspec/specs/dashboard-view?projectPath=...` is called
- **AND** `openspec/specs/dashboard-view/spec.md` exists
- **THEN** it returns the spec content with history entries

#### Scenario: Spec not found
- **WHEN** `GET /api/spek/openspec/specs/nonexistent?projectPath=...` is called
- **THEN** it returns HTTP 404

### Requirement: Spec at change endpoint
The server SHALL implement `GET /api/spek/openspec/specs/:topic/at/:slug` that returns the spec content as it exists within a specific change's delta specs.

#### Scenario: Spec version found
- **WHEN** `GET /api/spek/openspec/specs/api-adapter/at/2026-02-13-phase1?projectPath=...` is called
- **AND** the change contains a delta spec for `api-adapter`
- **THEN** it returns `{ content: "..." }` with the delta spec content

### Requirement: Changes list endpoint
The server SHALL implement `GET /api/spek/openspec/changes` that returns active and archived changes.

#### Scenario: Changes list response
- **WHEN** `GET /api/spek/openspec/changes?projectPath=...` is called
- **THEN** it returns `{ active: [...], archived: [...] }` with change metadata

### Requirement: Change detail endpoint
The server SHALL implement `GET /api/spek/openspec/changes/:slug` that returns full change details including proposal, design, tasks content, and affected specs.

#### Scenario: Change detail found
- **WHEN** `GET /api/spek/openspec/changes/2026-02-13-phase1?projectPath=...` is called
- **THEN** it returns the change with proposal, design, tasks markdown content and affected specs list

### Requirement: Graph data endpoint
The server SHALL implement `GET /api/spek/openspec/graph` that returns spec-change relationship data for visualization.

#### Scenario: Graph data response
- **WHEN** `GET /api/spek/openspec/graph?projectPath=...` is called
- **THEN** it returns nodes and edges representing specs and their related changes

### Requirement: Search endpoint
The server SHALL implement `GET /api/spek/openspec/search` with a `q` query parameter that performs full-text search across all spec and change content.

#### Scenario: Search with results
- **WHEN** `GET /api/spek/openspec/search?projectPath=...&q=dashboard` is called
- **THEN** it returns matching results with type, title, and context snippets

#### Scenario: Search with no results
- **WHEN** `GET /api/spek/openspec/search?projectPath=...&q=xyznonexistent` is called
- **THEN** it returns an empty array

### Requirement: OpenSpec scanner (Kotlin)
The server SHALL implement a Kotlin-based OpenSpec scanner that reads the `openspec/` directory structure. The scanner SHALL read `.md` and `.yaml` files only, and SHALL not expose arbitrary filesystem access.

#### Scenario: Scan directory structure
- **WHEN** the scanner processes a project with `openspec/specs/` and `openspec/changes/`
- **THEN** it returns a structured representation of all specs and changes with their metadata

#### Scenario: Security constraint
- **WHEN** a request attempts to read files outside the `openspec/` directory
- **THEN** the server SHALL reject the request

### Requirement: CORS headers for JCEF
The server SHALL include appropriate CORS headers to allow requests from the JCEF webview (which loads content from file:// or the built-in server).

#### Scenario: CORS preflight
- **WHEN** the JCEF webview sends a cross-origin request to the API
- **THEN** the server SHALL respond with `Access-Control-Allow-Origin` headers permitting the request
