## Why

VS Code extension 的 change detail spec tab 在 agent 寫 artifact 時不會自動更新（proposal/design/task 都會）。根因：extension 用 `vscode.workspace.createFileSystemWatcher` 監看，其在 Linux 的遞迴 watcher 底層是 `@parcel/watcher`，對 agent 快速建立的 `changes/<slug>/specs/<topic>/` 巢狀目錄掛不上 inotify watch，導致 `spec.md` 的新建與後續編輯事件全部漏掉（實測 `@parcel/watcher` 12/12 一致漏抓）。Web 版用 `chokidar`（會在收到新目錄後重掃補發事件）不受影響，實測 31+ 次 0 漏。

## What Changes

- VS Code extension host 改用 `chokidar` 監看 `openspec/`，取代 `vscode.workspace.createFileSystemWatcher`，使巢狀新建目錄（`specs/<topic>/`）內的 `spec.md` 新建與編輯都能被偵測。
- 涵蓋兩處 watcher：
  - `panel.ts` 的 `watchOpenspec`（Webview Panel 用，含 `addWorktreeWatchers` 的 worktree 監看）。
  - `extension.ts` 的 `treeWatcher`（sidebar Specs/Changes TreeView 用）。
- `packages/vscode/package.json` 新增 `chokidar` 執行期依賴，並確認 esbuild 打包設定正確納入。
- 維持既有對外行為：debounce 500ms、`postMessage({ type: "fileChanged" })`、worktree 聚合監看、panel/extension 釋放時清理 watcher。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `live-reload`: 「File change detection for VS Code version」需求中的「FileSystemWatcher setup」scenario 目前明文要求使用 `vscode.workspace.createFileSystemWatcher`；改為要求使用能正確偵測巢狀新建目錄的 watcher（`chokidar`），並補一個 scenario 明確要求偵測「新建巢狀目錄內的檔案」。

## Impact

- `packages/vscode/src/panel.ts` — `watchOpenspec` / `addWorktreeWatchers` 改用 chokidar。
- `packages/vscode/src/extension.ts` — `treeWatcher` 改用 chokidar。
- `packages/vscode/package.json` — 新增 `chokidar` 依賴。
- `packages/vscode/CHANGELOG.md`、root `CHANGELOG.md`、`packages/intellij/CHANGELOG.md` — 三邊同步記錄修正。
- `vscode-sidebar` capability 的「TreeView refresh on file changes」需求措辭與監看機制無關，僅實作層受影響，不需 spec delta。
- 無對外 API 變更、無破壞性變更。
