## 1. Worktrees endpoint + adapter methods

- [x] 1.1 Add a read-only `GET /api/openspec/worktrees` route in `packages/web/server/routes/openspec.ts` (returns `core.listWorkspaces(dir, { includeJj })`; honor `dir` + `jj`; no change scan)
- [x] 1.2 Add `getWorktrees(includeJj?)` to the `ApiAdapter` interface
- [x] 1.3 Implement `FetchAdapter.getWorktrees` → `GET /api/openspec/worktrees`
- [x] 1.4 Implement `MessageAdapter.getWorktrees` → `postMessage` `"getWorktrees"`
- [x] 1.5 Add a `getWorktrees` handler case in `packages/vscode/src/handler.ts` (discover jj independent of the setting, so the control can offer the jj option)
- [x] 1.6 Implement `StaticAdapter.getWorktrees` → the demo's single source (empty when none)
- [x] 1.7 Add `getAggregationPrefs()` / `setAggregationPrefs(aggregate, includeJj)` to the `ApiAdapter` interface; implement in `FetchAdapter` + `StaticAdapter` via the `localStorage` pref utilities
- [x] 1.8 Implement `MessageAdapter.getAggregationPrefs` / `setAggregationPrefs` → `postMessage`

## 2. VS Code settings + handler wiring

- [x] 2.1 Contribute the `spek.aggregateWorktrees` setting (boolean, default true) in `packages/vscode/package.json`
- [x] 2.2 Handler: add `aggregateEnabled()` (mirroring `jjEnabled()`) and apply it to `getChanges` / `getOverview` / `getGraphData`
- [x] 2.3 Handler: add `getAggregationPrefs` / `setAggregationPrefs` cases — read both settings; write both at `ConfigurationTarget.Workspace`
- [x] 2.4 `panel.ts`: extend the `onDidChangeConfiguration` refresh to also watch `spek.aggregateWorktrees`
- [x] 2.5 `tree-provider.ts`: read `spek.aggregateWorktrees` and pass it as `aggregate` to `scanOpenSpecAggregated`

## 3. App-level aggregation-scope context

- [x] 3.1 Create `AggregationScopeContext` owning the level + worktree list (sibling of `ThemeContext`)
- [x] 3.2 Back the level via the adapter's `getAggregationPrefs` / `setAggregationPrefs` (seed from `localStorage` for no-flash, reconcile on mount and on the refresh/live-reload signal)
- [x] 3.3 Mount the provider in `App.tsx`; make `useOverview` / `useChanges` / `useGraphData` read `aggregate` / `includeJj` from the context

## 4. Header control + Changes page cleanup

- [x] 4.1 Build the aggregation-scope control component (three-state segmented + compact `<select>` on mobile)
- [x] 4.2 Show the control in **both** hosts (remove the `isVsCodeWebview` gate); apply visibility (repo selected AND (`worktrees.length > 1` OR `hasJj`)) and offer the jj option only when `hasJj`
- [x] 4.3 Render the control in the `Layout` header next to the theme toggle
- [x] 4.4 Remove all aggregation control from `ChangeList.tsx` (Web tri-state + the VS-Code aggregate checkbox); read scope from the context

## 5. Tests & verification

- [x] 5.1 Unit-test the `/worktrees` query building and any pure visibility/level logic
- [x] 5.2 Run `npm test`, `npm run type-check`, and `npm run build:web` — all green
- [x] 5.3 Drive the Web app end-to-end: control in the header on every page, three scopes drive Overview/Changes/Graph, hidden for a single-worktree non-jj repo, jj option only when jj exists
- [x] 5.4 Drive VS Code end-to-end: the header control appears in the webview, toggling it writes the settings, and an external settings edit updates the control
