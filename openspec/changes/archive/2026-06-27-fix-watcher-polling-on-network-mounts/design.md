## Context

spek 三個 live 變體的檔案監看都建立在「OS 原生檔案事件」上：

- **Web** (`packages/web/server/routes/openspec.ts`)：chokidar，Linux 下走 inotify。
- **VS Code** (`packages/vscode/src/watcher.ts`)：chokidar，同上。
- **IntelliJ** (`packages/intellij/.../SpekBrowserPanel.kt`)：Java NIO `WatchService`，Linux 下 `sun.nio.fs.LinuxWatchService` 走 inotify（macOS 才用 `PollingWatchService`，Linux 無 polling fallback）。

問題的真正根源不是「在容器裡」，而是**被監看的路徑掛在不傳遞 inotify 事件的檔案系統上**。devcontainer / WSL 把 host 目錄以 9p（`/workspaces/...`）或 drvfs 掛進容器，inotify 對這類掛載不會收到事件（VS Code 本身也因此在 WSL/drvfs 上 fallback 到 polling）。同樣的問題也發生在 NFS、CIFS/SMB、virtualbox shared folder 等網路 / 虛擬檔案系統。

結果：容器內第一次開啟 spek 後，後續寫入的檔案（`brainstorm.md`、`plan.md`、opsx 漸進寫入的 `specs/<topic>/spec.md`）收不到事件，畫面靜默過期。資料讀取層（`discoverArtifacts` 等）本身正常——壞的只有「何時重新抓」這個觸發機制。

## Goals / Non-Goals

**Goals:**
- 三個變體在 inotify 不傳遞事件的掛載上仍能偵測檔案變更（改用 polling）。
- 在原生檔案系統（host、容器內的 overlayfs/ext4）上維持原生事件、零額外輪詢成本。
- 提供明確、跨變體一致的覆寫開關，讓使用者能強制開 / 關，不必只靠自動偵測。
- 偵測邏輯精準到「被監看路徑的檔案系統型別」，而非粗略的「是否在容器」，以免在 inotify 正常運作的容器內白白輪詢。

**Non-Goals:**
- 不改前端 `useFileWatcher` / SSE / postMessage / refresh 協定——只改 server / host 端 watcher 的底層機制。
- 不嘗試在 Windows / macOS host 上改變既有行為（原生事件已正常）。
- 不做可調的輪詢間隔 UI；提供合理預設與環境變數覆寫即可。

## Decisions

### 決策 1：以「檔案系統型別」為主要偵測訊號（而非「是否在容器」）

判斷是否需要 polling 的權威依據是被監看路徑所在掛載的 fstype。在 Linux 讀 `/proc/self/mountinfo`（或 `/proc/mounts`），找出涵蓋該路徑的最長掛載前綴，取其 fstype；若屬於已知「不傳遞 inotify 事件」集合則啟用 polling：

```
9p, v9fs, drvfs, cifs, smb3, smbfs, nfs, nfs4, fuse.*, vboxsf, vmhgfs, prl_fs, lustre, glusterfs, ...
```

- **理由**：這是真正的根因判別。devcontainer 的 workspace 若實際落在 overlayfs（純容器、非 bind mount），inotify 正常運作，就不該輪詢；反之掛 9p 就該輪詢——無論是否「在容器裡」。
- **平台**：非 Linux（win32 / darwin）一律回傳 false（原生事件正常）。`/proc` 不存在 / 讀取失敗 → 退回決策 2 的次要訊號。
- **替代方案**：(a) 純靠容器環境變數判斷——粗略，會在 overlayfs 容器誤判輪詢；(b) 實際掛一個探針 watcher 寫檔測試事件是否到達——啟動延遲高且有副作用。皆不採用為主要訊號。

### 決策 2：次要訊號與覆寫順序

最終 `usePolling` 的決定順序（高優先在前）：

1. **明確覆寫**（最高優先）
   - Web / Node：chokidar 既有的 `CHOKIDAR_USEPOLLING`（`true`/`1`/`false`/`0`）與 `CHOKIDAR_INTERVAL`，chokidar v5 已內建處理；另接受 `SPEK_WATCH_POLLING` 作為跨變體一致的別名。
   - VS Code：沿用上述環境變數（extension host 繼承容器環境）；可另加 `spek.fileWatcher.polling` 設定（`auto` / `on` / `off`，預設 `auto`）。
   - IntelliJ：系統屬性 / 環境變數 `SPEK_WATCH_POLLING`。
2. **fstype 偵測**（決策 1）。
3. **次要環境訊號**（當 `/proc` 不可讀時的保底）：`REMOTE_CONTAINERS`、`CODESPACES`、`WSL_DISTRO_NAME` / `WSL_INTEROP` 存在，或 `/.dockerenv` 存在；VS Code 另可參考 `vscode.env.remoteName` 非 undefined。

### 決策 3：偵測邏輯放在 `@spek/core`，IntelliJ 以 Kotlin 對齊重作

Web 與 VS Code 都是 TS，共用一個 `@spek/core` 純函式（例如 `shouldUsePolling(path): boolean` 與底層 `detectMountFsType(path)`），維持單一事實來源。IntelliJ 既有慣例是用 Kotlin 在 `core/` 重新實作核心邏輯（見 `ArtifactDiscovery.kt` 等），故新增對齊的 Kotlin 版（讀 `/proc/mounts`、相同 fstype 集合、相同覆寫變數），並附單元測試。

### 決策 4：各變體套用方式

- **Web**：`getOrCreateWatcher` 對 `watchPaths` 計算 `usePolling`（任一監看路徑需輪詢即開啟），傳入 chokidar options；`interval` 取 `CHOKIDAR_INTERVAL` 或預設（如 1000ms）。
- **VS Code**：`watchOpenspecDir(dir, onChange)` 對 `<dir>/openspec` 計算 `usePolling` 傳入 chokidar；其餘（debounce / postMessage）不變。
- **IntelliJ**：`setupNativeFileWatcher` 在需要 polling 時，**不**建立 `WatchService`，改啟動一個 daemon 輪詢執行緒：定期（如 1000ms）遞迴掃描 `openspec/` 下 `.md` / `.yaml` 的存在與 `lastModified`，與上次快照比對，有差異就走既有 `scheduleRefresh()`（沿用 500ms debounce）。原生路徑維持現有 `WatchService` 不變。

## Risks / Trade-offs

- **輪詢的 CPU / IO 成本** → 只在偵測到需要時啟用；間隔預設 1000ms 且只看 `.md`/`.yaml`，`openspec/` 規模小；提供 `CHOKIDAR_INTERVAL` 調整。
- **fstype 集合不完整，漏掉某種網路檔案系統** → 提供 `SPEK_WATCH_POLLING=on` 覆寫作為保底；集合採「已知會壞」清單並可逐步擴充。
- **誤判導致在原生 FS 上輪詢** → 主要訊號是 fstype 精準判別，誤判面小；即便誤判，行為仍正確（只是稍耗資源），可用 `=off` 關閉。
- **chokidar polling 的變更延遲 / 大量檔案** → `openspec/` 屬小型樹，延遲可接受；Web server 已對同資料用 chokidar 驗證過。
- **IntelliJ 輪詢執行緒生命週期** → 沿用既有 `disposed` 旗標與 `watchThread?.interrupt()` 釋放路徑，確保關閉時停止。

## Migration Plan

1. 在 `@spek/core` 新增 `shouldUsePolling` / `detectMountFsType` 與單元測試。
2. Web、VS Code 接上 helper；IntelliJ 加 Kotlin 對齊實作 + 輪詢分支與測試。
3. 三份 CHANGELOG 同步記錄。
4. Rollback：偵測預設 `auto`，若造成問題可文件指引使用者設 `SPEK_WATCH_POLLING=off` 立即回到原生行為；程式層面可單獨 revert helper 接線。

## Open Questions

- 預設輪詢間隔取 1000ms 是否足夠（對齊 chokidar 預設 `interval` 100ms 太密；VS Code WSL 用較長間隔）——傾向 1000ms，待實測。
- VS Code 是否需要顯式 `spek.fileWatcher.polling` 設定，或僅靠 fstype 偵測 + 環境變數即可——傾向先做偵測 + 環境變數，設定為可選加值。
