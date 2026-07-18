## MODIFIED Requirements

### Requirement: FetchAdapter for web
The web version SHALL use a `FetchAdapter` that calls the Express REST API via HTTP fetch. The FetchAdapter SHALL support configurable base URL to allow IntelliJ's built-in server to use a different API prefix (`/api/spek/openspec/`) than the web version (`/api/openspec/`).

#### Scenario: Fetch adapter API call
- **WHEN** `FetchAdapter.getOverview()` is called with repoPath set
- **THEN** it performs `fetch('/api/openspec/overview?dir=...')` and returns the parsed JSON response

#### Scenario: Fetch adapter error handling
- **WHEN** a fetch request returns a non-OK HTTP status
- **THEN** the adapter throws an error with the HTTP status code

#### Scenario: Fetch adapter getSpecAtChange
- **WHEN** `FetchAdapter.getSpecAtChange("user-auth", "2026-01-15-add-oauth")` is called
- **THEN** it performs `fetch('/api/openspec/specs/user-auth/at/2026-01-15-add-oauth?dir=...')` and returns the parsed JSON response

#### Scenario: Fetch adapter with custom base URL
- **WHEN** `FetchAdapter` is created with `baseUrl: '/api/spek'`
- **THEN** all API calls SHALL use `/api/spek/openspec/...` as the URL prefix instead of `/api/openspec/...`

#### Scenario: Fetch adapter with custom dir parameter name
- **WHEN** `FetchAdapter` is created with `dirParam: 'projectPath'`
- **THEN** all API calls SHALL use `projectPath` as the query parameter name instead of `dir`
