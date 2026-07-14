## ADDED Requirements

### Requirement: Resync endpoint
The server SHALL implement `POST /api/spek/openspec/resync`. Without it, the shared frontend's Refresh button — which posts to this path on every host — receives HTTP 404 in IntelliJ, turning every Refresh into a spurious error in the IDE.

The endpoint SHALL invalidate the server-side state this host actually holds that could serve a stale view. The Kotlin scanner maintains **no** git timestamp cache (`timestamp` is always `null`), so the endpoint SHALL NOT fabricate one; it SHALL clear the schema-order cache, which is exactly what the plugin's own file watcher already clears before it refreshes the webview. A manual Refresh SHALL NOT invalidate less than an automatic one does.

#### Scenario: Successful resync
- **WHEN** the client sends `POST /api/spek/openspec/resync?projectPath=/path/to/project`
- **THEN** the server clears the schema-order cache
- **AND** returns HTTP 200 with `{ ok: true }`

#### Scenario: Resync without projectPath parameter
- **WHEN** the client sends `POST /api/spek/openspec/resync` without a `projectPath` parameter
- **THEN** the server returns HTTP 400, consistent with the other `openspec/` endpoints

#### Scenario: Subsequent read reflects the cleared cache
- **WHEN** a change's schema order has changed on disk and the client resyncs
- **AND** the client then requests that change's detail
- **THEN** the response SHALL reflect the schema order currently on disk, not a cached earlier order
