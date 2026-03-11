## SpekBrowserPanel 健康檢查

- [x] 在 `SpekBrowserPanel.kt` 新增 `waitForApiReady(port: Int, encodedProjectPath: String)` 方法，使用 `HttpURLConnection` 輪詢 `GET http://localhost:$port/api/spek/fs/detect?path=$encodedProjectPath`，直到收到 HTTP 200 或超過 50 次重試（10 秒）
- [x] 修改 `createBrowserComponent()` 在 `waitForStart()` 之後、`invokeLater` 之前呼叫 `waitForApiReady()`，確保 handler 已就緒才載入 webview URL
