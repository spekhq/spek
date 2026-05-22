## MODIFIED Requirements

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
