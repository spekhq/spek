## Context

VS Code extension 的 sidebar TreeView 點擊 spec/change 時，會呼叫 `spek.navigateTo` command，該 command 透過 `SpekPanel.createOrShow()` 建立或取得 panel，然後立刻呼叫 `panel.navigateTo(routePath)` 發送 `{ type: "navigate", path }` 訊息。

問題在於：當 panel 是新建立的，webview 需要經過載入 HTML → 執行 JS → React mount → 發送 "ready" → 收到 "init" → `setReady(true)` → 渲染 RouterProvider 這整個流程後，才能處理 navigate 訊息。但 `navigateTo()` 在 panel 建構完成後立刻發送，此時 webview 尚未準備好接收。

同樣的問題也影響 `openSearch` 訊息（`spek.search` command）。

## Goals / Non-Goals

**Goals:**
- 確保 sidebar TreeView 點擊在 panel 未開啟時也能一次導航到正確頁面
- 確保 `spek.search` command 在 panel 未開啟時也能正確觸發搜尋
- 最小化改動範圍，僅修改 `panel.ts`

**Non-Goals:**
- 不改變 webview ready handshake 協議
- 不改變前端 React 路由機制
- 不處理 panel 已開啟但被 hidden 的情境（現有行為已正確）

## Decisions

### Decision 1: 在 SpekPanel 中加入 pending message queue

**選擇**：在 `SpekPanel` class 中追蹤 `webviewReady` 狀態，並維護一個 pending messages 陣列。當 webview 尚未 ready 時，`navigateTo()` 和 `postMessage()` 將訊息暫存；收到 "ready" handshake 並發送 "init" 後，依序 flush pending messages。

**替代方案**：
- 在前端 `WebviewApp.tsx` 處理（暫存 navigate 直到 router ready）— 但前端的 navigate handler 在 `useEffect` 中註冊，init 之前就已存在，問題在於訊息在 JS 載入前就被發送，前端無法接收。因此必須在 extension host 端解決。
- 使用 `setTimeout` 延遲發送 — 不可靠，取決於 webview 載入速度。

**理由**：extension host 端是唯一能可靠知道 webview 何時 ready 的地方（透過 "ready" message），在此處排隊最安全。

### Decision 2: 在 "ready" handler 中 init 之後再 flush

**選擇**：flush pending messages 的時機放在 "ready" handler 裡，緊接在發送 "init" 訊息之後。

**理由**：前端收到 "init" 後會 `setReady(true)`，但 React state update 是非同步的。不過 message event listener 在 `useEffect` 中已註冊且不依賴 `ready` state，navigate handler（`router.navigate(msg.path)`）直接操作 module-level 的 `router` 物件，不需等待 `ready` state 更新。因此 init 之後立刻發送 navigate 是安全的。

## Risks / Trade-offs

- **[Risk] 多個 pending navigate 訊息** → 只保留最後一個 navigate 路徑即可，因為同時只會有一個導航目標。但 openSearch 等其他訊息類型仍需完整 queue。實作上用單一 `pendingNavigate` 欄位加上通用 `pendingMessages` 陣列即可，或簡化為統一的 pending messages 陣列。
- **[Risk] Panel dispose 後 ready 永遠不會到達** → Panel dispose 時清理 pending queue，避免記憶體洩漏。現有的 `onDidDispose` handler 已處理清理邏輯。
