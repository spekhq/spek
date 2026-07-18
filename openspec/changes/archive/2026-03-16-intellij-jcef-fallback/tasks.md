## 1. Fallback UI 面板

- [x] 1.1 在 `SpekBrowserPanel.kt` 中改寫 `createFallbackComponent()`，建立 Swing 面板包含說明文字和「Open in Browser」按鈕
- [x] 1.2 實作 `buildBrowserUrl()` 方法，組合 Built-in Server URL（含 `projectPath`、`apiBase`、`theme` query params）

## 2. 外部瀏覽器啟動

- [x] 2.1 實作 `openInExternalBrowser()` 方法，使用 `BrowserUtil.browse()` 開啟組合好的 URL
- [x] 2.2 在 fallback 模式下，等待 Built-in Server API ready 後自動開啟外部瀏覽器（複用現有 `waitForApiReady()` 邏輯）
- [x] 2.3 綁定「Open in Browser」按鈕的 click handler 呼叫 `openInExternalBrowser()`

## 3. 測試驗證

- [x] 3.1 在 Android Studio 中安裝 plugin 並驗證 fallback 面板正確顯示
- [x] 3.2 驗證外部瀏覽器自動開啟且 spek Web UI 正常運作
- [x] 3.3 驗證「Open in Browser」按鈕可重新開啟瀏覽器
