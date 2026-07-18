## 1. SpekPanel pending message queue

- [x] 1.1 在 `SpekPanel` class 加入 `webviewReady: boolean` 欄位（預設 `false`）和 `pendingMessages: unknown[]` 陣列
- [x] 1.2 修改 "ready" message handler：發送 init 訊息後，設定 `webviewReady = true`，然後依序 flush `pendingMessages` 並清空陣列
- [x] 1.3 修改 `navigateTo()` 方法：若 `webviewReady` 為 `false`，將訊息推入 `pendingMessages`；否則直接發送
- [x] 1.4 修改 `postMessage()` 方法：同樣加入 ready 檢查與 queue 邏輯（處理 openSearch 等其他訊息）
- [x] 1.5 在 panel dispose handler 中清空 `pendingMessages` 和重設 `webviewReady`

## 2. 驗證與測試

- [x] 2.1 Build VS Code extension 並手動測試：關閉 spek panel 後從 sidebar 點擊 spec item，確認一次點擊即導航成功
- [x] 2.2 測試 sidebar 點擊 change item 同樣一次導航成功
- [x] 2.3 測試 panel 已開啟時點擊 sidebar item 仍正常運作（不受影響）
- [x] 2.4 測試 `spek.search` command 在 panel 未開啟時能正確觸發搜尋
