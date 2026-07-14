## RENAMED Requirements

- FROM: `### Requirement: Resync UI control`
- TO: `### Requirement: Refresh control`

## MODIFIED Requirements

### Requirement: Refresh control
The system SHALL display a Refresh button in the sidebar. Activating it SHALL invalidate the server-side state that the current host holds and that could otherwise serve a stale view, and SHALL then re-fetch the data backing the current page.

Cache invalidation is best-effort and SHALL NOT gate the re-fetch: if the invalidation request fails for any reason — including a host that does not provide the endpoint — the re-fetch SHALL still happen and the failure SHALL NOT surface as an unhandled rejection.

The button MUST show a busy state that persists until the re-fetched data has arrived, not merely until the invalidation request has returned.

#### Scenario: User triggers refresh
- **WHEN** the user clicks the Refresh button in the sidebar
- **THEN** the system sends `POST /api/openspec/resync` with the current repo path
- **AND** increments the `RefreshContext` `refreshKey`, causing every mounted `useAsyncData` hook to re-fetch
- **AND** the button shows a busy state until the re-fetched data has arrived

#### Scenario: Cache invalidation fails
- **WHEN** the resync request fails (network error, or the host does not serve the endpoint and returns HTTP 404)
- **THEN** the `refreshKey` SHALL still be incremented so the data is re-fetched
- **AND** the failure SHALL NOT surface as an unhandled promise rejection

#### Scenario: Displayed content is already current
- **WHEN** the user clicks Refresh and the underlying files have not changed on disk
- **THEN** the button still enters and completes its busy state, acknowledging the click
- **AND** the displayed content remains unchanged

#### Scenario: Refresh with no repo selected
- **WHEN** no repo is currently selected
- **THEN** the Refresh button is not displayed or is disabled

## ADDED Requirements

### Requirement: Host-specific scope of cache invalidation
The resync endpoint's contract SHALL be "invalidate the server-side state this host actually holds that could serve a stale view", not "perform one fixed set of actions". Each host SHALL invalidate the caches it actually maintains, and hosts that maintain different caches SHALL invalidate different things.

#### Scenario: Web and VS Code hosts invalidate the git timestamp cache
- **WHEN** the resync endpoint is invoked on the Web server or the VS Code extension host
- **THEN** the git timestamp cache for that repo SHALL be cleared and rebuilt

#### Scenario: A host without a given cache does not fabricate the work
- **WHEN** the resync endpoint is invoked on a host that does not maintain a git timestamp cache
- **THEN** that host SHALL NOT be required to rebuild one
- **AND** it SHALL invalidate whichever of its own caches could serve a stale view
