## Context

`SpekBrowserPanel.createBrowserComponent()` 在背景執行緒呼叫 `BuiltInServerManager.getInstance().waitForStart()` 後，立即透過 `invokeLater` 在 EDT 載入 webview URL。`waitForStart()` 僅保證 Netty server 開始監聽 port，不保證所有 `HttpRequestHandler` extension point 已完成註冊。因此前端載入後發出的 API 請求可能被 built-in server 以 404 回應。

## Goals / Non-Goals

**Goals:**
- 確保 webview 載入前 `SpekHttpRequestHandler` 已就緒並能回應 API 請求
- 解決啟動時 spec/change 詳情頁 HTTP 404 的問題

**Non-Goals:**
- 不修改前端錯誤處理或重試邏輯
- 不修改 `SpekHttpRequestHandler` 本身的路由邏輯

## Decisions

在 `SpekBrowserPanel.createBrowserComponent()` 的背景執行緒中，於 `waitForStart()` 之後、`invokeLater` 載入 URL 之前，加入輪詢健康檢查：

1. 使用 `java.net.HttpURLConnection` 對 `GET /api/spek/fs/detect?path=<projectPath>` 發出 HTTP 請求
2. 若回應為 HTTP 200 代表 handler 已就緒，結束輪詢
3. 若連線失敗或非 200，等待 200ms 後重試
4. 設定最大重試上限（例如 50 次 = 10 秒），超過上限仍載入 URL（降級處理，避免永遠卡住）
5. 每次重試前檢查 `disposed` 狀態，避免 panel 已關閉仍在輪詢

選用 `/api/spek/fs/detect` 作為健康檢查端點，因為它輕量、不依賴 openspec 目錄結構完整性，且已有現成實作。

## Risks / Trade-offs

- **延遲**：健康檢查會使 webview 載入稍微延遲（通常 200ms~2s），但比使用者看到 404 錯誤的體驗好
- **超時降級**：若 10 秒內 handler 仍未就緒，fallback 直接載入 URL，避免永久卡住
