## 1. RefreshContext：手動刷新與在途取數追蹤

- [x] 1.1 `packages/web/src/contexts/RefreshContext.tsx`：`refresh()` 接受 `manual` 旗標；只有 manual 會 arm 忙碌狀態（watcher 觸發的自動刷新不 arm，避免憑空冒出 spinner）
- [x] 1.2 同檔：新增在途取數計數與 `beginFetch()`（回傳「這次 fetch 已結束」的回呼），並暴露 `refreshing`；`refreshing` 自 arm 起為真，直到「已有 fetch 開始過**且**在途數歸零」。以世代（generation）區分「這次刷新引發的 fetch」與「刷新前就已在途的 fetch」，後者結束時不得解除忙碌狀態
- [x] 1.3 同檔：arm 後 500ms（`useAsyncData` 的 debounce 300ms 再加緩衝，避免計時器抖動誤判）內若無任何 fetch 開始，`refreshing` 自行解除，避免在沒有掛載取數 hook 時卡死
- [x] 1.4 同檔：新增 `liveStatus`（`live` / `offline` / `unsupported`）狀態與其 setter，供 `useFileWatcher` 回報
- [x] 1.5 `packages/web/src/hooks/useOpenSpec.ts`：`useAsyncData` 在 fetch 開始時呼叫 `beginFetch()`，並在 `.finally()`（涵蓋 resolve / reject / cancelled）呼叫其回傳的結束回呼；不改動既有的 debounce、保留舊資料、吞掉 refresh 期間錯誤等語意

## 2. Refresh 按鈕

- [x] 2.1 `packages/web/src/hooks/useOpenSpec.ts`：`useResync` 改為 `useRefreshData`，內部保證 resync 失敗（含宿主未提供端點的 404）不阻擋 `refresh(manual)`，且不產生 unhandled rejection
- [x] 2.2 `packages/web/src/components/Sidebar.tsx`：`ResyncButton` 改為 `RefreshButton` —— 文案 `Refresh` / `Refreshing...`、`title="Refresh"`、補上 `aria-label="Refresh"`（收合時圖示是唯一的 affordance）
- [x] 2.3 同檔：按鈕忙碌狀態改綁 `refreshing`（涵蓋到資料落地），而非只綁 resync 這個 POST 的往返

## 3. Watcher 環境判定與斷線可見化

- [x] 3.1 `packages/web/src/hooks/useFileWatcher.ts`：新增 IntelliJ 分支並直接 no-op，消掉那個對 `/api/openspec/watch` 開、必然 404、永遠重連的 `EventSource`（IntelliJ 的刷新由 `IntellijApp` 監聽 `spek:fileChanged` 完成）。宿主標記 `__spekIntellij` 於 `main.intellij.tsx` 設定，與 VS Code 的 `__vscodeApi`、Demo 的 `__DEMO_DATA__` 同一套慣例
- [x] 3.2 同檔：Web 分支處理 `EventSource` 的 `onopen` / `onerror` —— `onopen` → `liveStatus = live`；`onerror` 且 `readyState !== OPEN` → `liveStatus = offline`；復連時回到 `live`
- [x] 3.3 同檔：VS Code / IntelliJ 回報 `live`（管道無可觀測的失敗訊號，謊報 offline 比不報更糟）；Demo 回報 `unsupported`
- [x] 3.4 `packages/web/src/components/Sidebar.tsx`：`liveStatus === "offline"` 時顯示一行提示，引導使用者手動 Refresh；其餘狀態一律不顯示（不做常駐的「正常」指示燈）

## 4. IntelliJ resync 端點

- [x] 4.1 `packages/intellij/src/main/kotlin/com/spek/intellij/server/SpekHttpRequestHandler.kt`：`routeRequest` 新增 `openspec/resync` 路由，呼叫 `SchemaOrder.clearCache()` 後回 `{ ok: true }`；缺 `projectPath` 時比照其他 `openspec/` 端點回 400（由上游 `openspec/` 前綴的共用檢查負責）
- [x] 4.2 同檔：以註解寫明為何清的是 schema-order 而非 git timestamp（Kotlin scanner 沒有後者，`timestamp` 恆為 `null`），以及為何手動 refresh 不該比 file watcher 的自動刷新失效得更少

## 5. 測試

- [x] 5.1 忙碌狀態機與刷新不變式抽成不依賴 React 的純模組 `packages/web/src/contexts/refreshTracker.ts`（比照 repo 既有慣例：`TreeRefreshGate`、`decidePolling`）。web 的測試是 `node --import tsx --test`，沒有 React renderer，純模組才測得動
- [x] 5.2 `packages/web/src/contexts/refreshTracker.test.ts`：arm 才忙碌、自動刷新不冒 spinner、忙碌撐到在途取數歸零、結束回呼重複呼叫不提早解除、arm 前既有的 fetch 落地不誤解除（世代隔離）、無 fetch 開始時自解除、有 fetch 在途時逾時保護不誤介入；以及 `runManualRefresh` 在 resync 拋錯（含 404）時仍必定觸發 `refresh(true)` 且不逸出 rejection
- [x] 5.3 `packages/intellij/src/test/kotlin/com/spek/intellij/server/SpekHttpRequestHandlerTest.kt`：resync 路由存在且回 `{"ok":true}`、未知路徑仍回 null、resync 不碰專案目錄。（缺 `projectPath` 的 400 由 `process()` 的共用前綴檢查負責，該層需要 Netty channel，不在此單測範圍）
- [x] 5.4 跑 `npm run test -w @spekjs/web`（36 pass）、`npm run test -w @spekjs/core`（118 pass）、`npm run type-check`（綠）、IntelliJ `./gradlew test`（綠）。**`npm run lint` 略過**：repo 裡沒有 eslint 設定檔也沒有 eslint 相依，該 script 在 master 上本來就無法執行（既有問題，見 issue #16），不在本 change 範圍

## 6. 手動驗收

- [x] 6.1 Web 版（以 agent-browser 實測）：**完整重現 issue #18 並驗證修復** —— 掐斷 SSE 端點模擬 watcher 失效，編輯 `tasks.md` 新增一個 task，畫面不動（陳舊，正是回報者的處境）；按下 Refresh 後新 task 出現。另量測按鈕的請求與忙碌時序：`POST resync`（70ms 回）+ `GET changes/:slug`（424ms 落地）+ `GET specs`（465ms 落地），**忙碌狀態到 496ms 才解除** —— 撐到所有資料抵達之後（舊實作只發出 resync，且 70ms 就停）
- [x] 6.2 Web 版：中止 API server 後重載，sidebar 顯示「Live updates offline」；SSE 恢復後提示消失。另確認 watcher 自動刷新期間不會冒出 spinner（無回歸）
- [x] 6.3 IntelliJ 分支：以 EventSource 建構計數實測 —— Web 宿主建立 SSE 連線，設上 `__spekIntellij` 標記後建立 **0 條**，永遠重連的迴圈消失；resync 路由由 `SpekHttpRequestHandlerTest` 覆蓋（不再 404）

## 7. 文件

- [x] 7.1 **三份產品 CHANGELOG（root / vscode / intellij）不在本 change 動** —— 它們由 `/release` skill 於發版時統一撰寫（git 歷史：`CHANGELOG.md` 僅在 "Update CHANGELOG for vX.Y.Z" 的 commit 中變動；archived 的 `thread-default-schema` task 6.6 亦明文將產品 CHANGELOG 列為 integration-only）。發版時需涵蓋：Resync 更名為 Refresh 且真正重新載入、live updates 斷線提示、IntelliJ 的 resync 端點與 EventSource 空轉修正
- [x] 7.2 `packages/core/CHANGELOG.md` 不動：本 change 未更動 `@spekjs/core` 的公開 API（改動全在 `packages/web` 與 `packages/intellij`）
- [x] 7.3 `CLAUDE.md`：`RefreshContext` 已從單純的 refreshKey 擴充為「手動／自動刷新區分 + 在途取數追蹤 + live-update 狀態」，且新增純邏輯模組 `refreshTracker.ts`；補一段說明
