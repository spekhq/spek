## Context

IntelliJ plugin 目前使用 JCEF（JBCefBrowser）在 Tool Window 中嵌入 React SPA。但 Android Studio 的 JBR 不含 JCEF 模組，`JBCefApp.isSupported()` 回傳 `false`，導致使用者只看到靜態錯誤訊息。

經驗證，Android Studio 的 IntelliJ Built-in Server 仍正常運作，且 spek 的 `SpekHttpRequestHandler` 可正確提供 API 和靜態 webview 資源。外部瀏覽器可直接存取 `http://localhost:{port}/spek/webview/index.intellij.html` 並正常使用。

## Goals / Non-Goals

**Goals**
- 在 JCEF 不可用的環境（如 Android Studio）中，透過外部瀏覽器提供完整的 spek 瀏覽體驗
- Tool Window 顯示有意義的狀態面板，提供「在瀏覽器中開啟」操作

**Non-Goals**
- 不在 Kotlin 中實作新的 HTTP server — 完全複用現有 Built-in Server
- 不修改前端程式碼 — 外部瀏覽器直接使用 `index.intellij.html`
- 不處理 IDE 主題與外部瀏覽器的即時同步（外部瀏覽器僅在開啟時帶入當前主題）

## Decisions

### 1. 複用 Built-in Server 而非啟動獨立 HTTP server
- **選擇**：直接使用 IntelliJ Built-in Server + 現有 `SpekHttpRequestHandler`
- **替代方案**：啟動 Node.js Express server 或 Kotlin embedded server（如 Ktor）
- **理由**：Built-in Server 已隨 IDE 啟動，且 handler 已完整實作所有 API 和靜態資源。無需新增依賴，實作量最小

### 2. 使用 `BrowserUtil.browse()` 開啟外部瀏覽器
- **選擇**：使用 IntelliJ Platform SDK 內建的 `com.intellij.ide.BrowserUtil`
- **替代方案**：`java.awt.Desktop.browse()` 或 `Runtime.exec("open")`
- **理由**：`BrowserUtil` 是 IntelliJ 平台標準做法，跨平台相容性最好

### 3. Tool Window 顯示 Swing 面板而非空白
- **選擇**：fallback 時在 Tool Window 中顯示說明文字 + 「Open in Browser」按鈕
- **替代方案**：直接開啟瀏覽器不顯示 Tool Window 內容
- **理由**：使用者需要知道 spek 在運作中，也需要重新開啟瀏覽器的入口

### 4. 首次開啟 Tool Window 時自動啟動瀏覽器
- **選擇**：fallback 模式下首次建立 panel 時自動開啟瀏覽器，不需使用者手動點擊
- **替代方案**：只顯示面板等使用者點按鈕
- **理由**：減少操作步驟，使用者開啟 Tool Window 就是想看 spek 內容

## Risks / Trade-offs

- **[Built-in Server port 變動]** → port 由 `BuiltInServerManager.getInstance().port` 動態取得，不硬編碼
- **[Server 未就緒]** → 複用現有的 `waitForApiReady()` 邏輯，確認 API handler 可回應後才開啟瀏覽器
- **[主題不同步]** → 外部瀏覽器只在開啟時帶入 IDE 主題，後續主題切換不會同步。可接受的限制
- **[File watcher 不通知瀏覽器]** → 外部瀏覽器無法透過 JS injection 觸發 refresh，但使用者可手動重新整理。未來可考慮 SSE/WebSocket 方案

## Open Questions

（無）
