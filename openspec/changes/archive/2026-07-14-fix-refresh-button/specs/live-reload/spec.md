## MODIFIED Requirements

### Requirement: RefreshContext for frontend refresh coordination
The frontend SHALL provide a `RefreshContext` that coordinates data refresh across all hooks when file changes are detected or when the user requests a manual refresh.

`RefreshContext` SHALL distinguish a manual refresh (the user pressed Refresh) from an automatic one (the file watcher fired). Only a manual refresh SHALL arm the busy state, because a spinner appearing on its own during an automatic refresh is noise rather than information.

`RefreshContext` SHALL track in-flight fetches so that the busy state reflects when data has actually arrived, rather than when the request to invalidate caches returned.

#### Scenario: RefreshContext provides refreshKey
- **WHEN** a component or hook calls `useRefreshKey()`
- **THEN** it receives the current `refreshKey` number value from the context

#### Scenario: Refresh triggered by file change
- **WHEN** `refresh()` from `RefreshContext` is called
- **THEN** the `refreshKey` counter increments, causing all `useAsyncData` hooks to re-fetch their data

#### Scenario: Automatic refresh does not arm the busy state
- **WHEN** the file watcher triggers a refresh
- **THEN** the `refreshKey` increments and data re-fetches
- **AND** the `refreshing` busy state SHALL remain false

#### Scenario: Manual refresh arms the busy state until data arrives
- **WHEN** the user triggers a manual refresh
- **THEN** `refreshing` SHALL become true immediately
- **AND** SHALL remain true across the `useAsyncData` debounce delay and the resulting fetches
- **AND** SHALL become false only once at least one fetch has begun and all in-flight fetches have settled

#### Scenario: Manual refresh with no data hooks mounted
- **WHEN** a manual refresh is triggered and no `useAsyncData` hook begins a fetch within the debounce window
- **THEN** `refreshing` SHALL clear itself rather than remain stuck true

### Requirement: useFileWatcher hook
The frontend SHALL provide a `useFileWatcher` hook that connects to the appropriate file change event source based on the runtime environment. The hook SHALL NOT open a connection in an environment whose refresh is delivered by another channel; in particular it SHALL NOT fall through to the Web SSE branch on a host that does not serve the Web API.

#### Scenario: Web environment with SSE
- **WHEN** `useFileWatcher` is active in the Web environment
- **THEN** it opens an `EventSource` connection to `/api/openspec/watch?dir=<repoPath>` and calls `refresh()` on each received event

#### Scenario: VS Code environment with postMessage
- **WHEN** `useFileWatcher` is active in the VS Code webview environment
- **THEN** it listens for `message` events with `type === "fileChanged"` and calls `refresh()` on each received event

#### Scenario: IntelliJ environment is a no-op
- **WHEN** `useFileWatcher` is active in the IntelliJ webview environment
- **THEN** it SHALL NOT open an `EventSource` to `/api/openspec/watch`, a path the IntelliJ built-in server does not serve
- **AND** refresh SHALL instead be delivered by the `spek:fileChanged` window event dispatched from the plugin

#### Scenario: Demo environment no-op
- **WHEN** `useFileWatcher` is active in the Demo environment
- **THEN** it does nothing (no event source to connect to)

#### Scenario: Cleanup on unmount
- **WHEN** the component using `useFileWatcher` unmounts
- **THEN** the EventSource connection or message listener SHALL be cleaned up

### Requirement: Debounced re-fetch in useAsyncData
The `useAsyncData` hook SHALL support automatic re-fetch triggered by `refreshKey` changes with debounce to avoid excessive requests. It SHALL report the start and settlement of each fetch to `RefreshContext` so the manual-refresh busy state can track when data has actually arrived.

#### Scenario: Re-fetch on refreshKey change
- **WHEN** `refreshKey` changes in the `RefreshContext`
- **THEN** `useAsyncData` triggers a new fetch after a 300ms debounce delay

#### Scenario: Debounce coalesces rapid changes
- **WHEN** `refreshKey` changes multiple times within 300ms
- **THEN** only one re-fetch is triggered after the last change

#### Scenario: Existing data preserved during re-fetch
- **WHEN** a re-fetch is triggered by `refreshKey` change
- **THEN** the existing `data` SHALL remain visible (no loading flash) until the new data arrives

#### Scenario: Refresh failure with existing data
- **WHEN** a re-fetch triggered by `refreshKey` change fails with an error
- **AND** the hook already has existing data from a previous successful fetch
- **THEN** the existing `data` SHALL be preserved
- **AND** the `error` state SHALL NOT be set (remains null)

#### Scenario: Refresh failure without existing data
- **WHEN** a re-fetch triggered by `refreshKey` change fails with an error
- **AND** the hook has no existing data (data is null)
- **THEN** the `error` state SHALL be set to the error message

#### Scenario: Fetch lifecycle reported to RefreshContext
- **WHEN** `useAsyncData` begins a fetch
- **THEN** it SHALL report the fetch as in-flight to `RefreshContext`
- **AND** SHALL report it as settled once the fetch resolves, rejects, or is cancelled

## ADDED Requirements

### Requirement: Live update connection status
The frontend SHALL track whether its live-update channel is connected, and SHALL surface a disconnected channel to the user so that a silently dead watcher becomes a visible state rather than an invisible one. The user SHALL be told that manual Refresh is the way forward while the channel is down.

The status SHALL only be surfaced when it is bad. A permanently displayed "connected" indicator is noise and dulls the signal that matters.

#### Scenario: Web SSE connection opens
- **WHEN** the `EventSource` for `/api/openspec/watch` fires `onopen`
- **THEN** the live-update status SHALL be `live`
- **AND** no status indicator SHALL be displayed

#### Scenario: Web SSE connection fails
- **WHEN** the `EventSource` fires `onerror` and its `readyState` is not `OPEN`
- **THEN** the live-update status SHALL be `offline`
- **AND** the sidebar SHALL display an indication that live updates are offline, directing the user to Refresh manually

#### Scenario: Web SSE connection recovers
- **WHEN** an `EventSource` that had gone `offline` subsequently fires `onopen`
- **THEN** the live-update status SHALL return to `live`
- **AND** the offline indication SHALL be removed

#### Scenario: Hosts without an observable channel failure
- **WHEN** running in the VS Code or IntelliJ webview, whose refresh channels expose no failure signal
- **THEN** the live-update status SHALL be `live`
- **AND** no offline indication SHALL be displayed, because reporting an unobservable state as offline would be a false alarm

#### Scenario: Demo environment has no live updates
- **WHEN** running in the Demo environment
- **THEN** the live-update status SHALL be `unsupported`
- **AND** no status indicator SHALL be displayed
