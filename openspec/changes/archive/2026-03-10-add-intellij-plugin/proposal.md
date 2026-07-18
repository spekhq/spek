## Why

spek 目前僅支援 VS Code extension 和 Web 版，但有部分使用者使用 IntelliJ IDEA 系列 IDE。為了擴大使用者覆蓋範圍，需要新增 IntelliJ plugin，讓 JetBrains IDE 使用者也能在 IDE 內直接瀏覽 OpenSpec 內容。

## What Changes

- 新增 `packages/intellij/` 目錄，包含 Kotlin 開發的 IntelliJ Platform Plugin
- 使用 IntelliJ 內建 Built-in Server（HttpRequestHandler），實作與 Express 後端相同的 REST API
- 使用 JCEF（JetBrains 內建 Chromium）載入現有 React SPA 前端
- 前端透過現有 FetchAdapter 連接內嵌 server，無需新增 adapter
- 新增 Vite build 設定，產出 IntelliJ webview 用的前端資源
- Kotlin 端重新實作 `@spek/core` 的掃描/讀取邏輯（讀取 openspec/ 目錄的 .md/.yaml 檔案）

## Capabilities

### New Capabilities

- `intellij-plugin-host`: IntelliJ plugin 主體，包含 plugin 生命週期、Tool Window 註冊、JCEF webview 載入、專案偵測與自動啟用
- `intellij-embedded-server`: 內嵌 HTTP server（Ktor），實作 REST API 端點，Kotlin 版的 openspec 掃描/讀取/搜尋邏輯
- `intellij-webview`: JCEF webview 整合，載入 React SPA 前端資源、主題同步、IDE 與 webview 間通訊

### Modified Capabilities

- `api-adapter`: 新增 IntelliJ webview 用的 Vite build 設定（build:intellij），產出適用於 JCEF 載入的前端資源

## Impact

- **新增依賴**：Gradle + IntelliJ Platform SDK + kotlinx-serialization（JSON）
- **專案結構**：monorepo 新增 `packages/intellij/` 目錄
- **Build 流程**：新增 `npm run build:intellij` 指令（build 前端資源）+ Gradle build（plugin 本體）
- **前端 build**：需新增類似 `build:webview` 的 Vite 設定，產出 JCEF 可載入的靜態資源
- **CI/CD**：未來需新增 JetBrains Marketplace 發布流程
