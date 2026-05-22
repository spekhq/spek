## Context

VS Code extension 目前用 `vscode.workspace.createFileSystemWatcher` 監看 `openspec/**`，共兩處：

- `panel.ts` 的 `watchOpenspec(dir)` — Webview Panel 用，事件 → `notifyFileChange()`（debounce 500ms → `postMessage({ type: "fileChanged" })`）。`addWorktreeWatchers()` 會對每個 worktree 各呼叫一次 `watchOpenspec`。
- `extension.ts` 的 `treeWatcher` — sidebar TreeView 用，事件 → `refreshTree()`（debounce 500ms → 重整 specs/changes provider）。

`createFileSystemWatcher` 的遞迴 watcher 在 Linux 底層是 `@parcel/watcher`，對 agent 連續快速建立的巢狀目錄（`changes/<slug>/specs/<topic>/`）掛不上 inotify watch，該子樹內 `spec.md` 的新建與後續編輯事件全部漏掉（實測 12/12）。Web server 用 `chokidar` 不受影響（收到新目錄會重掃補發事件，實測 31+ 次 0 漏）。

`packages/vscode` 全部程式碼由 esbuild `--bundle` 從 devDependencies 打包進 `dist/extension.js`，`vsce package --no-dependencies` 不另外帶 `node_modules`。

## Goals / Non-Goals

**Goals:**

- VS Code extension 改用 `chokidar` 監看 `openspec/`，使巢狀新建目錄內的 `spec.md` 新建與編輯都能被偵測。
- 兩處 watcher（`panel.ts`、`extension.ts`）皆改用 chokidar，行為對齊 Web server。
- 維持既有對外行為：500ms debounce、`postMessage({ type: "fileChanged" })`、worktree 聚合監看、panel/extension 釋放時清理 watcher。

**Non-Goals:**

- 不改 Web server 的 chokidar watcher（已正常）。
- 不改 IntelliJ plugin 的 NIO `WatchService`（屬另一條程式路徑，本 change 不涵蓋）。
- 不改 debounce 時間、postMessage 協定、webview 端 refresh 邏輯（`useFileWatcher` / `RefreshContext`）。

## Decisions

### 採用 chokidar 取代 createFileSystemWatcher

`chokidar` 在偵測到新目錄後會重新 `readdir` 補發子項目事件，能正確涵蓋快速建立的巢狀目錄；spek Web server 已用 `chokidar@5`（`packages/web`）並實測穩定。替代方案：(a) 維持 `createFileSystemWatcher` 但在收到目錄 create 時 dispose／重建整個 watcher 觸發重掃 — hack 且後續編輯仍可能漏；(b) 改用輪詢 — 耗能且延遲高。皆不採用。

### 監看設定對齊 Web server

chokidar 設定比照 `packages/web/server/routes/openspec.ts`：監看 `path.join(dir, "openspec")`、`ignored` 過濾掉非 `.md`/`.yaml` 檔、`ignoreInitial: true`、`persistent: true`。事件監聽 `add`/`change`/`unlink`，並一併監聽 `addDir`/`unlinkDir`（涵蓋僅目錄變動的情況、更穩健，成本可忽略）。

### 抽出共用 watcher helper

`panel.ts` 與 `extension.ts` 需要相同的 chokidar 建立邏輯，抽到新檔 `packages/vscode/src/watcher.ts`，匯出 `watchOpenspecDir(dir, onChange): vscode.Disposable`：內部建立 chokidar watcher、把任一相關事件轉呼叫 `onChange`，並回傳包好 `chokidar.FSWatcher.close()` 的 `vscode.Disposable`。各呼叫端維持自己既有的 500ms debounce（`notifyFileChange` / `refreshTree`），不改 debounce 歸屬。

### 打包

`chokidar@5` 為純 JS（僅依賴 `readdirp`，無 `fsevents` 等原生模組），加入 `packages/vscode` 的 `devDependencies` 後由 esbuild `--bundle` 直接內聯，無需調整 esbuild 參數或 `vsce` 設定。

### Disposable 整合

chokidar `FSWatcher.close()` 回傳 Promise；helper 回傳的 `vscode.Disposable` 的 `dispose()` 直接呼叫 `close()`（不需 await）。panel 的 watcher 仍放入 `this.disposables`、treeWatcher 仍放入 `context.subscriptions`，釋放流程不變。

## Risks / Trade-offs

- **chokidar 啟動時遞迴掃描 `openspec/` 成本** → `ignoreInitial: true` + 只收 `.md`/`.yaml`；Web server 對同樣資料已驗證可接受。
- **Linux inotify watch 數量** → chokidar v5 單一 inotify instance、每目錄一個 watch descriptor；實測 aggregate 1036 目錄僅用 1 instance、遠低於上限。
- **macOS 無 `fsevents`** → chokidar v5 本就不依賴 `fsevents`，於 macOS 走 `fs.watch`，對 `openspec/` 規模完全足夠。
- **行為回歸風險（debounce / postMessage / worktree / 清理）** → helper 只負責「建立 watcher + 轉發事件」，debounce 與通知邏輯留在原呼叫端，將差異面縮到最小。

## Migration Plan

無資料遷移。實作後依 CLAUDE.md 重新打包 extension（`build @spek/core` → `build:webview` → `build spek-vscode` → `vsce package`）驗證。Rollback 即還原 commit。
