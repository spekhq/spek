## Why

Sidebar 底部那顆環形箭頭按鈕（`ResyncButton`）長得就是全世界通用的 reload 圖示，sidebar 收合時更只剩下這個圖示、連 "Resync" 字樣都不顯示。使用者理所當然把它當成 refresh —— 而它**不會 refresh**：`useResync` 從頭到尾沒有呼叫 `RefreshContext` 的 `refresh()`，`refreshKey` 不動，`useAsyncData` 就不會重取，畫面上不會有任何東西改變。使用者在 [issue #18](https://github.com/spekhq/spek/issues/18) 回報：編輯 `tasks.md` 新增一個 task 後按下它，內容沒有更新；切到別的頁面再切回來（元件重新掛載、重新取數）才看得到新 task。

這不是「缺一個 requirement」，是**實作漂離了既有規格**。`openspec-api` 的 `Resync UI control` 早就寫著：

> **AND** on success, the current page data is refreshed to reflect updated ordering

程式碼從來沒做到這件事。連它自己剛 resync 好的 git timestamp 都要等使用者離開再回來才看得見。

而使用者之所以會伸手去按那顆按鈕，是因為 file watcher 在他的環境沒有自動刷新。本機實測（原生檔案系統 + Web 版 SSE）watcher 是正常的：編輯 `tasks.md` 會立刻推出 `{"type":"changed"}`。所以 watcher 的失效與環境相關，目前無法重現、也不該憑空猜一個根因去修。但它暴露了真正的結構問題：**watcher 是會靜默失效的，而它一失效，使用者手上沒有任何能用的退路** —— 唯一長得像 refresh 的按鈕正好是壞的，而且 SSE 斷線完全沒有任何跡象（`EventSource` 的 `onerror` 根本沒有處理）。

## What Changes

- **Sidebar 的 Resync 改名為 Refresh，並真的重新載入資料。** 按下去 = 讓伺服端該失效的快取失效 + 呼叫 `refresh()` 讓所有 `useAsyncData` 重取。「resync git timestamps」是實作細節，使用者不需要、也無從分辨它與「重新載入」的差別；UI 上不該逼他分辨。
- **快取失效失敗不得阻擋重新取數。** resync 這一步是 best-effort：即使它丟出錯誤（例如宿主根本沒有這個端點），`refresh()` 仍然必須執行。目前 `useResync` 的 `try/finally` 沒有 `catch`，失敗會變成 unhandled promise rejection，按鈕整個無作用。
- **IntelliJ 補上 resync 端點。** `SpekHttpRequestHandler.routeRequest` 沒有這條路由，IntelliJ 版按下按鈕會 404。IntelliJ 的 Kotlin scanner 並沒有 git timestamp 快取（`timestamp` 恆為 `null`），所以該端點的正確語意就是「沒有東西需要失效」，回 `{ ok: true }`。
- **修掉 IntelliJ 的 EventSource 空轉。** `useFileWatcher` 在 IntelliJ 下既非 demo、也沒有 `__vscodeApi`、`repoPath` 又有值，於是掉進 Web 分支，對 `/api/openspec/watch` 開一個 `EventSource`。IntelliJ 內建 server 只服務 `/api/spek/` 前綴，這條路徑必然 404，`EventSource` 因此永遠重連、永遠失敗。IntelliJ 真正的刷新管道是 JCEF 注入的 `spek:fileChanged` window event（已由 `IntellijApp` 處理），所以 `useFileWatcher` 在 IntelliJ 下應為 no-op。
- **Live updates 斷線要看得見。** Web 版的 SSE 連線狀態目前無人聞問。改為追蹤連線狀態，斷線時在 sidebar 明示「自動更新已中斷」，讓使用者知道要手動按 Refresh —— 把一個靜默失效變成一個看得見的狀態。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `openspec-api`: `Resync UI control` requirement 改寫為 Refresh control —— 明確要求按下後必定重新取數，且快取失效步驟失敗時仍須重新取數。
- `sidebar-toggle`: 收合狀態下的按鈕由 Resync 改稱 Refresh，tooltip 與無障礙名稱一併更新。
- `live-reload`: `useFileWatcher` 新增 IntelliJ 環境分支（no-op，改由 `spek:fileChanged` 驅動）；新增「watcher 連線狀態可見」requirement。
- `intellij-embedded-server`: 新增 resync 端點 requirement。

## Impact

- `packages/web/src/components/Sidebar.tsx` — `ResyncButton` → `RefreshButton`（文案、tooltip、aria-label、行為）
- `packages/web/src/hooks/useOpenSpec.ts` — `useResync` 改為 `useRefreshData`：resync（best-effort）+ 必定 `refresh()`
- `packages/web/src/hooks/useFileWatcher.ts` — IntelliJ 分支；SSE 連線狀態
- `packages/web/src/contexts/RefreshContext.tsx` — 暴露 watcher 連線狀態供 UI 顯示
- `packages/intellij/src/main/kotlin/com/spek/intellij/server/SpekHttpRequestHandler.kt` — 新增 `openspec/resync` 路由
- 三個發行通道（Web / VS Code / IntelliJ）的 CHANGELOG

不影響 `@spekjs/core` 的公開 API，因此不動 `packages/core/CHANGELOG.md`。
