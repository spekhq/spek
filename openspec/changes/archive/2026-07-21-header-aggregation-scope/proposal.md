## Why

The aggregation scope — whether to aggregate OpenSpec changes across git worktrees, and whether to
include jj workspaces — is a **global** view preference. It is read by the Changes list, the
Dashboard/Overview, the Graph view, the Timeline, and the live-reload file watcher. Yet the only
control that can change it lives on the Changes page. A user on Overview / Graph / Timeline is
affected by the setting but has no way to change it there, and the control's placement implies it is
a Changes-page concern rather than an app-wide one. VS Code already treats this as a global setting
(`spek.aggregateJjWorkspaces`); the Web version is the outlier. Moving the control to the global
header makes its placement match its actual scope.

## What Changes

- Move the three-state aggregation-scope control (`Current dir` / `Worktrees` / `Worktrees + jj`) out
  of the Changes page into the global app header (next to the theme toggle), reachable from every page
  **in both the Web app and the VS Code webview**.
- Back the control by each host's own native storage, abstracted behind two adapter methods
  `getAggregationPrefs()` / `setAggregationPrefs()`:
  - **Web** → the browser `localStorage` preferences (as today).
  - **VS Code** → the VS Code settings. The control reads the current `spek.aggregateWorktrees` /
    `spek.aggregateJjWorkspaces` values and writes them back, so toggling the control is **equivalent
    to editing `settings.json`**, and editing the settings (file or Settings UI) updates the control
    via a config-change → webview refresh. Writes target the **Workspace** settings scope.
- Add the `spek.aggregateWorktrees` setting (boolean, default true) alongside the existing
  `spek.aggregateJjWorkspaces`; both become the VS Code source of truth, resolved by the handler.
  **Remove the webview aggregate checkbox** — VS Code's control is now the same header control, backed
  by settings.
- Add a minimal read-only `GET /api/openspec/worktrees` endpoint (a thin wrapper over
  `core.listWorkspaces`) plus a `getWorktrees()` adapter method, so the header learns the
  worktree / jj landscape cheaply — for visibility and the jj option — without the full change scan
  `/changes` does. jj discovery is independent of the current scope, so the jj option can be offered
  even when jj is currently off.
- The aggregation behavior, the tri-state semantics (invalid `aggregate off + jj on` unrepresentable),
  and jj's opt-in / default-off behavior are unchanged.
- Show the control only when there is something to aggregate (more than one worktree, or jj detected);
  the jj option appears only when jj workspaces exist — removing the single-worktree-non-jj noise.
- `ChangeList` renders no aggregation control for any host.

## Capabilities

### New Capabilities

- `aggregation-scope-control`: The global header control (a three-state segmented control: current
  directory / git worktrees / git worktrees + jj workspaces) present in **both** the Web app and the
  VS Code webview. Covers placement in the header, visibility rules, the per-host preference storage
  abstracted behind the adapter (browser `localStorage` on Web; VS Code settings in the webview,
  bidirectionally synced), and how the detected-worktree data drives the control.

### Modified Capabilities

- `change-browsing`: The "Aggregation toggle control" requirement is removed from the change list —
  the control leaves the Changes page for the global header (both hosts). The change-row worktree
  source indicators and worktree-qualified change links are unaffected.
- `openspec-api`: Adds a read-only `GET /api/openspec/worktrees` endpoint (returns the discovered
  worktree list via `core.listWorkspaces`), and three `ApiAdapter` methods — `getWorktrees()`,
  `getAggregationPrefs()`, and `setAggregationPrefs()`. FetchAdapter / StaticAdapter back the prefs
  methods with `localStorage`; MessageAdapter routes them to the VS Code extension host. No existing
  endpoint changes.
- `vscode-sidebar`: Adds the `spek.aggregateWorktrees` setting; the extension handler resolves both
  aggregation settings as the source of truth and serves `getAggregationPrefs` / `setAggregationPrefs`
  (reading / writing the two settings at the Workspace scope) and `getWorktrees`. The webview
  aggregate checkbox is removed; editing the settings updates the webview via the existing
  config-change refresh.

## Impact

- **Web frontend** (`packages/web/src`): the header/shell gains the control, `ChangeList.tsx` loses
  its control, a new `AggregationScopeContext` owns the level + worktree list, reusing `aggregationLevel`
  and the preference utilities.
- **Backend / adapters**: a read-only `/api/openspec/worktrees` endpoint (wrapping the already-exported
  `core.listWorkspaces`) and three adapter methods (`getWorktrees`, `getAggregationPrefs`,
  `setAggregationPrefs`). **No `@spekjs/core` change**, and no change to any existing endpoint.
- **VS Code**: adds the `spek.aggregateWorktrees` setting; the handler resolves both settings
  (mirroring `jjEnabled` with an `aggregateEnabled`) and serves the new adapter methods
  (`setAggregationPrefs` writes to the Workspace settings scope); removes the webview checkbox; the
  config-change listener refreshes the webview for both settings. Aggregation behavior is unchanged.
  **IntelliJ is unaffected.**
- No change to aggregation semantics, the jj opt-in / default-off behavior, or the tri-state model.
