## Why

spek 的三個 live 變體（Web、VS Code、IntelliJ）都依賴作業系統原生的檔案事件來觸發 live-reload，但這些事件在 9p / drvfs 等「網路型」bind mount 上不會傳遞——這正是 devcontainer 與 WSL 把 host 目錄掛進容器時的情況。結果是：在容器內開啟 spek 後，後續新增的檔案（例如 `brainstorm.md`、`plan.md`、opsx 漸進寫入的 `specs/<topic>/spec.md`）永遠收不到事件，畫面靜默停留在開啟當下的狀態，使用者誤以為「host 正常、容器壞掉」。

## What Changes

- 三個變體的檔案監看在偵測到 remote / container 環境時，自動改用 **polling**（輪詢）模式，使其在 inotify 不傳遞事件的掛載上仍能偵測變更。
- 提供明確的覆寫開關，讓使用者可強制開啟或關閉 polling，不必依賴自動偵測：
  - Web server：尊重 chokidar 既有的 `CHOKIDAR_USEPOLLING` / `CHOKIDAR_INTERVAL` 環境變數（已內建），並新增自動偵測。
  - VS Code：以 `vscode.env.remoteName` 判定 remote，並沿用同一組環境變數覆寫。
  - IntelliJ：Java NIO `WatchService` 不支援 polling 選項，故在 remote / container 時改以輪詢掃描執行緒取代 `WatchService`。
- 在原生檔案系統（host、非容器）上行為不變——預設仍走原生事件，不額外耗用 CPU。

## Capabilities

### New Capabilities
<!-- 無新增 capability -->

### Modified Capabilities
- `live-reload`: 三個變體（Web / VS Code / IntelliJ）的「檔案變更偵測」需求新增一條：當執行於原生檔案事件無法傳遞的環境（remote / container，如 9p、drvfs 掛載）時，watcher SHALL 改用 polling 以確保仍能偵測變更，並提供環境變數 / 設定覆寫。

## Impact

- **程式碼**
  - `packages/web/server/routes/openspec.ts` — `getOrCreateWatcher` 的 chokidar 選項加入自動 polling 偵測。
  - `packages/vscode/src/watcher.ts` — `watchOpenspecDir` 依 `vscode.env.remoteName` / 環境變數設定 `usePolling`。
  - `packages/intellij/src/main/kotlin/com/spek/intellij/SpekBrowserPanel.kt` — `setupNativeFileWatcher` 在 remote / container 時改走輪詢掃描。
- **規格**：`openspec/specs/live-reload/spec.md`（三個變體需求）。
- **相依**：無新增套件（chokidar 已支援 polling；IntelliJ 用標準 JDK / Kotlin）。
- **文件**：`CHANGELOG.md`、`packages/vscode/CHANGELOG.md`、`packages/intellij/CHANGELOG.md` 三份同步；必要時於 README 說明覆寫開關。
- **效能**：僅在偵測到 remote / container 時啟用 polling，host 上零額外成本。
