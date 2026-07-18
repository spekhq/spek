## Why

Android Studio 使用 Google 自訂的 JBR（JetBrains Runtime），不包含 JCEF 模組，導致 `JBCefApp.isSupported()` 回傳 `false`。目前 fallback 只顯示「JCEF is not available」的靜態文字，使用者完全無法使用 spek plugin。Android Studio 是最廣泛使用的 JetBrains IDE 之一，必須提供可用的替代方案。

## What Changes

- 當 JCEF 不可用時，利用現有的 IntelliJ Built-in Server（已提供完整 API + 靜態 webview 資源），自動在外部瀏覽器開啟 spek Web UI
- Tool Window 顯示友善的狀態面板，包含「在瀏覽器中開啟」按鈕，而非無法操作的錯誤訊息
- File watcher 在外部瀏覽器模式下仍透過 Built-in Server API 正常運作（瀏覽器端自動生效）

## Capabilities

### New Capabilities
- `intellij-external-browser-fallback`: 當 JCEF 不可用時，透過 IntelliJ Built-in Server + 外部瀏覽器提供完整的 spek 瀏覽體驗

### Modified Capabilities
- `intellij-webview`: 更新 JCEF 不可用時的 fallback 行為，從顯示靜態錯誤訊息改為啟動外部瀏覽器模式

## Impact

- **IntelliJ Plugin（Kotlin）**：`SpekBrowserPanel.kt` 的 `createFallbackComponent()` 需改寫，新增外部瀏覽器開啟邏輯和 Swing UI 面板
- **無新增依賴**：完全利用現有 Built-in Server 和 `com.intellij.ide.BrowserUtil`，無需 Node.js 或額外 HTTP server
- **前端**：不需要修改，外部瀏覽器直接使用現有的 `index.intellij.html`
