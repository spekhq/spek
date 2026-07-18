## Why

IntelliJ plugin 啟動時，`SpekBrowserPanel` 透過 `BuiltInServerManager.waitForStart()` 等待內建 server 啟動後就立即載入 webview URL。但 `waitForStart()` 僅確保 Netty server 開始監聽 port，不保證 `HttpRequestHandler` extension point 已完成註冊。導致前端在 server handler 尚未就緒時發出 API 請求，收到 HTTP 404。使用者需等待幾秒後重新點擊才能正常顯示。

## What Changes

- 在 `SpekBrowserPanel` 載入 webview URL 前，加入 API 健康檢查輪詢機制，確認 `SpekHttpRequestHandler` 已就緒
- 確保 webview 載入時所有 API 請求都能正常回應，消除啟動時的 404 錯誤

## Capabilities

### New Capabilities

（無新增 capability）

### Modified Capabilities

- `intellij-embedded-server`: 新增啟動時 API handler 就緒保證的需求，確保 webview 載入前 API 已可回應

## Impact

- `packages/intellij/src/main/kotlin/com/spek/intellij/SpekBrowserPanel.kt` — 修改 `createBrowserComponent()` 方法，加入健康檢查邏輯
