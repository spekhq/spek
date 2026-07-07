## ADDED Requirements

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
