## Context

spek 目前提供三種使用方式：Web 版（Express + React SPA）、VS Code Extension（Webview + MessageAdapter）、Demo（靜態 HTML）。前端透過 `ApiAdapter` 介面抽象通訊層，後端邏輯集中在 `@spek/core`（純 Node.js）。

IntelliJ IDEA 系列 IDE 有相當的使用者基數，需要一個原生 plugin 來支援 IDE 內瀏覽 OpenSpec 內容。IntelliJ Platform 提供 JCEF（基於 Chromium）來嵌入網頁內容，且有內建 HTTP server 基礎設施。

## Goals / Non-Goals

**Goals:**
- IntelliJ IDE 使用者可在 Tool Window 中瀏覽 OpenSpec 內容
- 重用現有 React SPA 前端，最小化前端程式碼變動
- 提供與 Web 版/VS Code 版一致的功能體驗（dashboard、specs、changes、graph、search）
- 支援深色/淺色主題跟隨 IDE 設定

**Non-Goals:**
- 不實作 IntelliJ sidebar TreeView（MVP 不需要，未來可擴充）
- 不支援 JetBrains Marketplace 自動發布（MVP 手動發布）
- 不支援 IntelliJ 版本低於 2023.1（JCEF 穩定版起始）
- 不實作 Git timestamp cache（MVP 用檔案修改時間）

## Decisions

### D1: 使用 JCEF + 內嵌 HTTP Server 策略

**選擇**：Plugin 內嵌輕量 HTTP server，JCEF 載入 React SPA，前端用現有 FetchAdapter 連接。

**替代方案**：
- **JCEF + JS-Java Bridge**：需要新增 JcefAdapter，前端改動大，bridge API 不穩定
- **純 Swing UI**：需要完全重寫前端，維護成本極高
- **啟動外部 Node.js server**：依賴使用者環境有 Node.js，不可靠

**理由**：內嵌 HTTP server 讓前端零修改即可運作，Ktor/Netty 在 JVM 上非常輕量，且 API 介面與 Express 版完全一致。

### D2: 使用 IntelliJ 內建 Built-in Server 而非獨立 Ktor

**選擇**：使用 IntelliJ Platform 內建的 `org.jetbrains.ide.BuiltInServerManager` 和 `HttpRequestHandler` 來處理 REST API。

**替代方案**：
- **獨立 Ktor server**：需額外依賴，增加 plugin 大小，port 管理複雜
- **獨立 Netty server**：同上問題

**理由**：IntelliJ 已內建基於 Netty 的 HTTP server，plugin 只需註冊 `HttpRequestHandler` 即可新增 API 端點。無需額外依賴、無 port 衝突問題、生命週期由 IDE 管理。

### D3: Kotlin 重新實作 OpenSpec 掃描/讀取邏輯

**選擇**：用 Kotlin 重新實作 `@spek/core` 的核心功能（scanOpenSpec、readSpec、readChange 等）。

**替代方案**：
- **Bundle Node.js runtime**：plugin 大小暴增 50MB+，不實際
- **呼叫外部 Node.js**：依賴使用者環境，不可靠

**理由**：`@spek/core` 的邏輯主要是檔案讀取 + YAML parsing + Markdown 處理，用 Kotlin 重寫工作量可控。JVM 生態有成熟的 YAML（kaml/snakeyaml）和 JSON（kotlinx-serialization）函式庫。

### D4: 前端資源打包為 IIFE 嵌入 plugin JAR

**選擇**：新增 Vite build 設定（`build:intellij`），產出 IIFE 格式的 JS + HTML，打包進 plugin JAR 的 resources 目錄。JCEF 透過 file:// 或 built-in server URL 載入。

**理由**：與 VS Code webview 的打包策略一致，確保離線可用，不依賴外部 CDN。

### D5: 主題同步透過 CSS 變數注入

**選擇**：Plugin 偵測 IDE 主題（light/dark），透過 JCEF 的 `executeJavaScript()` 注入 CSS class（`dark`/`light`）到 document root。

**理由**：前端已透過 Tailwind dark mode class 支援主題切換，只需在 JCEF 端設定即可。

### D6: Plugin 最低相容 IntelliJ 2023.3

**選擇**：`since-build` 設為 233（IntelliJ 2023.3）。

**理由**：JCEF 在 2023.1 後穩定，2023.3 確保足夠的 API 支援和使用者覆蓋。

## Risks / Trade-offs

- **[Kotlin 重寫維護成本]** → 核心邏輯在 TypeScript 和 Kotlin 各一份，未來修改需雙邊同步。→ 緩解：保持 API 介面一致，用相同的整合測試驗證。
- **[JCEF 相容性]** → 少數 IDE 版本或遠端開發場景可能不支援 JCEF。→ 緩解：設定 `since-build` 為 233，提供 fallback 提示訊息。
- **[搜尋品質差異]** → Kotlin 版搜尋實作可能與 Fuse.js 的模糊匹配結果不同。→ 接受：MVP 先用簡單子字串匹配，功能足夠。
- **[Plugin JAR 大小]** → 包含前端資源可能使 plugin 較大。→ 緩解：IIFE bundle 壓縮後通常 < 1MB。
