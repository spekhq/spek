## ADDED Requirements

### Requirement: Worktrees endpoint

The system SHALL provide a read-only `GET /api/openspec/worktrees` that returns the discovered working
directories for a repository via `core.listWorkspaces` — git worktrees, and jj workspaces when jj
inclusion is requested. It SHALL require the `dir` parameter and accept an optional `jj` parameter that
controls whether jj workspaces are enumerated. It SHALL return only the worktree list (each entry
carrying at least `key`, `path`, `branch`, `isMain`, and `vcs`) and SHALL NOT scan changes.

#### Scenario: List worktrees for a multi-worktree repo

- **WHEN** client sends `GET /api/openspec/worktrees?dir=/path/to/repo`
- **THEN** system returns a JSON array of the repository's git worktrees, each with `key`, `path`,
  `branch`, `isMain`, and `vcs`

#### Scenario: jj parameter controls jj workspace enumeration

- **WHEN** client sends `GET /api/openspec/worktrees?dir=/path/to/repo&jj=true` on a colocated repo
  with jj workspaces
- **THEN** the returned list includes jj workspaces (entries with `vcs: "jj"`)
- **AND WHEN** jj enumeration is not requested, only git worktrees are returned

#### Scenario: Worktrees endpoint without dir parameter

- **WHEN** client sends `GET /api/openspec/worktrees` without a `dir` parameter
- **THEN** system returns HTTP 400 with error message "dir parameter is required"

### Requirement: Worktrees in ApiAdapter

The system SHALL extend the `ApiAdapter` interface with a `getWorktrees()` method. `FetchAdapter` SHALL
call `GET /api/openspec/worktrees`. `MessageAdapter` SHALL use `postMessage` with type `"getWorktrees"`,
served by a corresponding case in the VS Code extension host handler (via `core.listWorkspaces`).
`StaticAdapter` (Demo) SHALL return the demo's single-source worktree list (which may be empty).

#### Scenario: FetchAdapter worktrees

- **WHEN** `FetchAdapter.getWorktrees()` is called
- **THEN** it sends `GET /api/openspec/worktrees?dir=...` and returns the parsed JSON array

#### Scenario: MessageAdapter worktrees

- **WHEN** `MessageAdapter.getWorktrees()` is called
- **THEN** it sends a `postMessage` with `{ type: "getWorktrees" }` and returns the response data
- **AND** the VS Code extension host handler resolves it via `listWorkspaces`

#### Scenario: StaticAdapter worktrees

- **WHEN** the Demo `StaticAdapter.getWorktrees()` is called
- **THEN** it returns the demo's single-source worktree list without contacting a server

### Requirement: Aggregation preferences in ApiAdapter

The system SHALL extend the `ApiAdapter` interface with `getAggregationPrefs()` (returns
`{ aggregate, includeJj }`) and `setAggregationPrefs(aggregate, includeJj)`, so the aggregation-scope
control reads and writes the preference through each host's native storage. `FetchAdapter` and
`StaticAdapter` SHALL back these with the browser `localStorage` preferences. `MessageAdapter` SHALL
route them to the VS Code extension host, where the handler resolves them against the VS Code settings.

#### Scenario: FetchAdapter reads and writes localStorage prefs

- **WHEN** `FetchAdapter.getAggregationPrefs()` is called
- **THEN** it returns the current `aggregate` / `includeJj` values from `localStorage`
- **AND WHEN** `FetchAdapter.setAggregationPrefs(a, jj)` is called, it persists both to `localStorage`

#### Scenario: MessageAdapter routes prefs to the extension host

- **WHEN** `MessageAdapter.getAggregationPrefs()` or `setAggregationPrefs(a, jj)` is called
- **THEN** it sends a `postMessage` (`getAggregationPrefs` / `setAggregationPrefs`) to the VS Code
  extension host and the host resolves it against the VS Code settings
