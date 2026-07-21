## Purpose

監控 openspec 檔案變更並自動刷新前端內容，讓檢視即時反映磁碟狀態。
## Requirements
### Requirement: File change detection for Web version

The Web server SHALL monitor OpenSpec content for file changes using `chokidar` and push notifications to connected clients via Server-Sent Events (SSE). When worktree aggregation is active for a connection, the server SHALL monitor the `openspec/` directory of every aggregated worktree, so that changes made in any worktree (for example by a parallel agent) refresh the aggregated view.

#### Scenario: SSE endpoint connection

- **WHEN** a client connects to `GET /api/openspec/watch?dir=<repoPath>`
- **THEN** the server opens an SSE stream and begins monitoring `<repoPath>/openspec/` for `.md` and `.yaml` file changes

#### Scenario: File change notification

- **WHEN** a `.md` or `.yaml` file inside a monitored `openspec/` directory is created, modified, or deleted
- **THEN** the server sends an SSE event `data: {"type":"changed"}` to all connected clients for that directory, debounced at 500ms

#### Scenario: Watch all worktrees under aggregation

- **WHEN** a client connects with aggregation active and the repository has multiple worktrees
- **THEN** the server monitors the `openspec/` directory of every worktree
- **AND** a `.md` or `.yaml` change in any of those worktrees triggers a `data: {"type":"changed"}` event

#### Scenario: Client disconnect cleanup

- **WHEN** a client disconnects from the SSE endpoint
- **THEN** the server removes the client from the notification list and cleans up the watcher(s) if no other clients are connected for that directory

#### Scenario: Shared watcher per directory

- **WHEN** multiple clients connect to the same `dir` parameter
- **THEN** the server SHALL reuse the same chokidar watcher instance(s) for that directory

### Requirement: File change detection for VS Code version

The VS Code extension SHALL monitor OpenSpec content for file changes and notify the webview. Monitoring SHALL reliably detect files that are created or modified inside directories which were themselves newly created (for example a change's `specs/<topic>/` delta-spec directory), even when the directory and its contents are created in the same rapid write burst. When worktree aggregation is active, the extension SHALL also monitor the `openspec/` directory of every other worktree of the same repository, not only the workspace folder.

#### Scenario: Watcher setup

- **WHEN** the spek Webview Panel is created
- **THEN** the extension host starts a recursive `chokidar` watcher on the workspace folder's `openspec/` directory

#### Scenario: Detect files in newly created nested directories

- **WHEN** a delta-spec file is created at `openspec/changes/<slug>/specs/<topic>/spec.md` and its parent directories `specs/` and `specs/<topic>/` did not previously exist
- **THEN** the watcher detects the new `spec.md` and triggers a webview notification
- **AND** subsequent modifications to that `spec.md` are also detected and trigger a notification

#### Scenario: Watch other worktrees under aggregation

- **WHEN** worktree aggregation is active and the repository has worktrees outside the current workspace folder
- **THEN** the extension host starts a `chokidar` watcher on the `openspec/` directory of each such worktree

#### Scenario: File change notification to webview

- **WHEN** a `.md` or `.yaml` file, or a directory, inside a monitored `openspec/` directory is created, modified, or deleted
- **THEN** the extension host sends `{ type: "fileChanged" }` to the webview via `postMessage`, debounced at 500ms

#### Scenario: Watcher cleanup

- **WHEN** the spek Webview Panel is disposed
- **THEN** all file watchers SHALL be closed along with other panel resources

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

### Requirement: Polling fallback on filesystems without native change events

All live variants (Web, VS Code, IntelliJ) that watch the `openspec/` directory SHALL detect file changes even when the watched path resides on a filesystem that does not deliver native OS change events (for example 9p, drvfs/WSL, CIFS/SMB, NFS, or FUSE bind mounts as used by devcontainers and WSL). When such a filesystem is detected, the variant SHALL fall back to a polling-based watch instead of relying on native events (inotify on Linux). On filesystems where native events work (the host, container overlay filesystems), the variant SHALL keep using native events and SHALL NOT poll.

The decision to poll SHALL follow this precedence: an explicit user override first, then detection of the watched path's filesystem type, then a fallback environment heuristic when the filesystem type cannot be determined.

#### Scenario: Watched path is on a non-event filesystem

- **WHEN** a variant starts watching an `openspec/` directory whose backing filesystem type is one known not to deliver native change events (e.g. `9p`, `drvfs`, `cifs`, `nfs`, `fuse.*`)
- **THEN** the variant SHALL use a polling-based watch
- **AND** a `.md` or `.yaml` file created or modified after the watch starts SHALL be detected and trigger the variant's existing change notification

#### Scenario: Watched path is on a native-event filesystem

- **WHEN** a variant starts watching an `openspec/` directory whose backing filesystem delivers native change events (e.g. `ext4`, `overlay`, or any path on a Windows/macOS host)
- **THEN** the variant SHALL use native event watching and SHALL NOT enable polling

#### Scenario: Explicit override forces polling on or off

- **WHEN** the environment variable `SPEK_WATCH_POLLING` (or `CHOKIDAR_USEPOLLING` for the chokidar-based variants) is set to a truthy value such as `on`/`true`/`1`
- **THEN** the variant SHALL use polling regardless of filesystem detection
- **AND WHEN** it is set to a falsy value such as `off`/`false`/`0`
- **THEN** the variant SHALL NOT poll regardless of filesystem detection

#### Scenario: Filesystem type cannot be determined

- **WHEN** the watched path's filesystem type cannot be determined (for example `/proc/mounts` is unreadable) and no explicit override is set
- **THEN** the variant SHALL enable polling if a remote/container environment is indicated (for example `REMOTE_CONTAINERS`, `CODESPACES`, or a WSL indicator is present), otherwise SHALL use native events

### Requirement: Watch jj workspaces

When aggregation is enabled and jj inclusion is on, the live-reload file watcher SHALL watch the
`openspec/` directory of each jj workspace in addition to git worktrees, so edits made in a jj
workspace trigger a refresh. Directory enumeration for watching SHALL use `listWorkspaces` (per the
`worktree-aggregation` capability) so the watched set matches the aggregated set.

#### Scenario: Edit in a jj workspace triggers refresh

- **WHEN** the watcher is active over a repo with an added jj workspace and a file under that
  workspace's `openspec/` changes
- **THEN** a refresh is triggered

