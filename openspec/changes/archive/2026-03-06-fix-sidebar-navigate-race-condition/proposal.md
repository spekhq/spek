## Why

從 VS Code sidebar TreeView 點擊 spec 或 change 時，如果 spek webview panel 尚未開啟，`navigateTo()` 會在 webview 還沒載入完成前就發送 `{ type: "navigate" }` 訊息，導致訊息被丟失。使用者必須點擊第二次才能正確導航。這是一個 race condition，嚴重影響 sidebar 的使用體驗。

## What Changes

- 在 `SpekPanel` 中加入 webview ready 狀態追蹤，確保 navigate 訊息在 webview 準備好後才發送
- 若 webview 尚未 ready，將 navigate 請求暫存（pending），待收到 "ready" handshake 並完成 init 後再發送
- 同樣機制適用於 `openSearch` 等其他需要 webview ready 的訊息

## Capabilities

### New Capabilities

（無新增）

### Modified Capabilities

- `vscode-sidebar`: TreeView item navigation 需補充 scenario — 當 webview panel 尚未開啟時，點擊 sidebar item 應能一次導航到正確頁面
- `webview-integration`: Webview ready handshake 需擴展 — navigate 等訊息應排隊等待 ready 完成後再發送

## Impact

- `packages/vscode/src/panel.ts` — 主要修改，加入 pending message queue 與 ready 狀態追蹤
- 不影響 web 版或 demo 版，僅限 VS Code extension
- 無 API 變更，無依賴變更
