## 1. Core 偵測邏輯（@spek/core）

- [x] 1.1 在 `packages/core/src` 新增 `watch-polling.ts`，匯出 `shouldUsePolling(path: string): boolean`：依序套用「明確覆寫（`SPEK_WATCH_POLLING` / `CHOKIDAR_USEPOLLING`）→ fstype 偵測 → 環境保底」的決定順序
- [x] 1.2 在同檔實作 `detectMountFsType(path: string): string | null`：Linux 讀 `/proc/self/mountinfo`（或 `/proc/mounts`），找出涵蓋該路徑的最長掛載前綴並回傳其 fstype；非 Linux 或讀取失敗回 `null`
- [x] 1.3 定義「不傳遞原生事件」的 fstype 集合（`9p`、`v9fs`、`drvfs`、`cifs`、`smb3`、`smbfs`、`nfs`、`nfs4`、`fuse.*`、`vboxsf`、`vmhgfs`、`prl_fs` 等），供 `shouldUsePolling` 判定
- [x] 1.4 從 `@spek/core` 匯出上述 API（必要時新增 subpath export，避免 webview bundle 打包 server-only 模組）
- [x] 1.5 新增 unit test（`node:test` + tsx）：覆寫優先序、各 fstype 判定、`/proc` 不可讀時的環境保底、Windows/macOS 回 false

## 2. Web server 接線

- [x] 2.1 `packages/web/server/routes/openspec.ts` 的 `getOrCreateWatcher`：對 `watchPaths` 計算 `usePolling`（任一路徑需輪詢即開啟），傳入 chokidar options
- [x] 2.2 輪詢間隔取 `CHOKIDAR_INTERVAL` 或預設 1000ms（透過 chokidar `interval` / `binaryInterval`）
- [x] 2.3 驗證：原生 FS（Windows host）預設不開輪詢、`SPEK_WATCH_POLLING=on/off` 覆寫如預期；chokidar `usePolling:true` 確實偵測到 watcher ready 後才新建的檔案（容器失效情境的核心行為）。註：真正 9p 掛載下的 fstype 偵測 e2e 需於實際 devcontainer 驗證

## 3. VS Code extension 接線

- [x] 3.1 `packages/vscode/src/watcher.ts` 的 `watchOpenspecDir`：對 `<dir>/openspec` 以 `shouldUsePolling` 計算 `usePolling` 傳入 chokidar，其餘事件 / debounce / postMessage 不變
- [x] 3.2 將 `vscode.env.remoteName` 非 undefined 納入環境保底訊號（傳給 / 補強 core 判定）
- [x] 3.3 確認 esbuild 仍正確內聯 chokidar（無新增原生相依）

## 4. IntelliJ plugin 接線

- [x] 4.1 在 `packages/intellij/.../core` 新增 Kotlin 對齊實作（讀 `/proc/mounts`、相同 fstype 集合、相同覆寫變數 `SPEK_WATCH_POLLING`），含 `src/test/kotlin` 單元測試
- [x] 4.2 `SpekBrowserPanel.kt` 的 `setupNativeFileWatcher`：需要 polling 時不建立 `WatchService`，改啟動 daemon 輪詢執行緒，定期遞迴掃描 `openspec/` 下 `.md`/`.yaml` 的存在與 `lastModified`，與快照比對後走既有 `scheduleRefresh()`（沿用 500ms debounce）
- [x] 4.3 沿用 `disposed` 旗標與 `watchThread?.interrupt()` 釋放路徑，確保輪詢執行緒在 dispose 時停止
- [x] 4.4 驗證：`WatchPolling.scanSnapshot` 單元測試證實輪詢偵測機制能偵測 watcher 啟動後新建的檔案、巢狀新建目錄內的 `spec.md`，並只計入 `.md`/`.yaml`、跳過 dotdir（對應 chokidar 的 polling smoke test）。原生路徑維持 `WatchService` 不變。註：實際 IDE 內、真 9p 掛載下的 e2e 仍需於 devcontainer 驗證

## 5. 文件與收尾

- [x] 5.1 同步更新 `CHANGELOG.md`、`packages/vscode/CHANGELOG.md`、`packages/intellij/CHANGELOG.md`（三份一致；併入 1.4.0 區段）
- [x] 5.2 於 README / README.zh-TW 說明 `SPEK_WATCH_POLLING` 與 `CHOKIDAR_USEPOLLING` / `CHOKIDAR_INTERVAL` 覆寫開關（devcontainer / WSL 情境）
- [x] 5.3 `npm run type-check` 與 `npm run test -w @spek/core`（85 pass）通過；IntelliJ `WatchPollingTest`（18 pass）通過
- [x] 5.4 更新 CLAUDE.md（@spek/core watch-polling API）
