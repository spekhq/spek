# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

spek 是一個 OpenSpec 內容檢視器，提供四種使用方式：
1. **Web 版**：本地唯讀 Web 應用（Express + React SPA），使用者啟動後在 UI 中選擇 repo 路徑瀏覽
2. **VS Code Extension**：直接在 VS Code 中開啟 Webview Panel 瀏覽當前 workspace 的 OpenSpec 內容
3. **IntelliJ Plugin**：在 IntelliJ IDEA 系列 IDE 中透過 Tool Window + JCEF 瀏覽 OpenSpec 內容
4. **Demo**：獨立靜態 HTML（`docs/demo.html`），內嵌 spek 自身的 openspec 資料，可部署至 GitHub Pages

## Tech Stack

- **Core**: `@spek/core` — 共用邏輯（scanner、tasks parser、型別定義），純 Node.js
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4
- **Backend**: Express.js (Node.js) — 讀取本地檔案系統提供 REST API
- **VS Code Extension**: Webview Panel + esbuild bundling
- **IntelliJ Plugin**: Kotlin + JCEF + IntelliJ Built-in Server
- **Markdown**: react-markdown + remark-gfm（含 BDD 語法高亮）
- **Search**: Server-side 全文搜尋 + Fuse.js
- **Routing**: React Router v7（Web: BrowserRouter, Webview: MemoryRouter）

## Project Structure (Monorepo)

```
packages/
├── core/       # @spek/core — 純邏輯，無框架依賴
│   └── src/    # scanner.ts, tasks.ts, git-cache.ts, types.ts
├── web/        # @spek/web — Express + React 應用
│   ├── server/ # Express API server
│   └── src/    # React SPA + API adapters
├── vscode/     # spek-vscode — VS Code Extension
│   ├── src/    # extension.ts, panel.ts, handler.ts
│   └── webview/ # Vite build output（由 web build:webview 產出）
└── intellij/   # spek-intellij — IntelliJ Platform Plugin
    ├── src/main/kotlin/com/spek/intellij/  # Kotlin 原始碼
    └── src/main/resources/webview/          # Vite build output（由 web build:intellij 產出）
scripts/        # Build 工具（build-demo.ts）
docs/           # 靜態產出（demo.html，GitHub Pages 部署）
.agents/
└── skills/     # Claude Code skills（原始檔）
    └── frontend-design/  # 前端設計指引 skill
.claude/
└── skills/     # Symlinks → .agents/skills/（Claude Code 自動偵測）
```

## Development Commands

```bash
npm install              # 安裝所有 workspace 依賴
npm run dev              # 啟動 Web 版：Vite (5173) + Express (3001)
npm run build            # Build core + web
npm run build:core       # Build @spek/core
npm run build:web        # Build @spek/web（web 版 production build）
npm run build:webview    # Build webview assets（給 VS Code extension 用）
npm run build:vscode     # Build VS Code extension
npm run build:demo       # Build 獨立 demo HTML（docs/demo.html）
npm run build:intellij   # Build IntelliJ webview assets
npm run type-check       # TypeScript type check
npm run test -w @spek/core  # 跑 @spek/core 的 unit test（node:test + tsx）
```

**Web 開發**：`npm run dev` 後存取 http://localhost:5173

**VS Code Extension 打包**：
```bash
npm run build -w @spek/core && npm run build:webview -w @spek/web && npm run build -w spek-vscode
cd packages/vscode && npx vsce package --no-dependencies
```

**IntelliJ Plugin 打包**：
```bash
npm run build -w @spek/core && npm run build:intellij
cd packages/intellij && ./gradlew buildPlugin
# 產出: packages/intellij/build/distributions/spek-intellij-*.zip
```

## Architecture

### Core Module (`@spek/core`)
純函式 + 型別定義，可被 web server 和 extension host 共用：
- `scanOpenSpec(basePath)` — 掃描單一目錄的 OpenSpec 結構
- `scanOpenSpecAggregated(basePath, { aggregate })` — 跨 worktree 聚合掃描：探索同 repo 全部 worktree，active changes 聯集並附來源、archived 依 slug 去重、specs 取主 worktree；單一 worktree / 非 git / 關閉聚合時等同 `scanOpenSpec`
- `readSpec(basePath, topic)` — 讀取單一 spec（含歷史）
- `readChange(basePath, slug, orderProvider?)` — 讀取單一 change；回傳 `ChangeDetail`，內含動態探索的 `artifacts` 陣列（預設 mtime 序）、`schema` 欄位、以及 `schemaOrder`（schema 權威順序的 artifact id 清單，供前端 schema-order 排序用；只對 active change 查 CLI，archived / CLI 不可用時為 undefined）。`orderProvider` 可注入以利測試
- `discoverArtifacts(changePath)` — 以檔案系統為準探索 change 的 artifacts：root 每個 `*.md`（忽略 dotfile / 非 md）為一個 artifact、非空 `specs/` 為一個 specs artifact，依 kind（`markdown` / `tasks` / `specs`）分類；排序依檔案 mtime 由新到舊（見下）。`countArtifacts(changePath)` 不讀內容算出數量供列表用
- **Artifact 預設 mtime 排序 + 使用者可選排序** — `artifacts.ts` 的 `discoverArtifacts` 以檔案 mtime 由新到舊排序（root 檔案取自身 mtime、`specs` 取其 delta 檔案中最新的 mtime），讓執行中被編輯的 artifact（如 tasks）浮到最前；mtime 相同時（例如剛 clone/checkout）以穩定的預設順序 tiebreak（`proposal, design, specs, tasks` 優先、其餘字母序）。**掃描（scanOpenSpec）永遠不呼叫 CLI**。前端提供排序控制（Last modified 預設 / Schema order / A–Z，mode id 分別為 `modified` / `schema` / `alpha`，偏好存於 `localStorage["spek:artifact-sort"]`，全域套用）：`modified` 用交付的 mtime 序、`alpha` 依標題、`schema` 依 `ChangeDetail.schemaOrder` 排序。`schemaOrder` 由 `readChange` 呼叫 `schema-order.ts` 的 `cliSchemaOrderProvider`（`openspec status --change <slug> --json` → `parseOrderFromStatus` 取 `planningArtifacts` + `artifactPaths`，`resolveSchemaOrder` 對應成 artifact id 清單）算出，**只在單一 change detail 讀取時查一次（有 cache），不進掃描熱路徑**；CLI 不可用或 archived change 時 `schemaOrder` 為 null，前端退回預設敘事序並顯示原因（active → CLI 未安裝、archived → 不追蹤 schema 順序）。change 顯示用的 schema 名稱仍從 `.openspec.yaml` `schema:` 讀取（fallback `openspec/config.yaml`），純讀 yaml key 非解析 schema
- `readSpecAtChange(basePath, topic, slug)` — 讀取特定 change 中的 spec 歷史版本
- `buildGraphData(basePath)` — 建立 spec-change 關聯圖資料
- `buildGraphDataAggregated(basePath, { aggregate })` — 跨 worktree 聚合的關聯圖（change 節點 id 以 `change:<worktreeKey>:<slug>` 命名避免碰撞）
- `listWorktrees(basePath)` — 以 `git worktree list --porcelain` 列出同 repo 全部 worktree；非 git / 無 `git` 時回 `[]`
- `shouldUsePolling(path, opts?)` / `pollingInterval(env?)` — 判定檔案監看是否該改用 polling（`watch-polling.ts`）。原生事件（inotify）在 9p/drvfs/NFS/CIFS 等掛載上不傳遞（devcontainer/WSL），故依「被監看路徑的 fstype」決定：純函式 `decidePolling` 套用優先序「明確覆寫（`SPEK_WATCH_POLLING`/`CHOKIDAR_USEPOLLING`）→ fstype 偵測（讀 `/proc/mounts`）→ remote 環境保底」。Web/VS Code 傳給 chokidar `usePolling`；IntelliJ 以 Kotlin 對齊版（`WatchPolling.kt`）在需要時改走輪詢掃描執行緒
- `parseTasks(content)` — 解析 tasks.md checkbox
- `extractHeadings(content)` / `slugifyHeading(text)` — 解析 markdown h2/h3 並產生穩定 slug，給 spec detail TOC 與 VS Code sidebar 共用（從 `@spek/core/headings` subpath 引入，避免 webview bundle 把 server-only 模組打包進去）
- 共用型別：`OverviewData`, `SpecInfo`, `ChangeInfo`, `ChangeDetail`, `ChangeArtifact`, `ArtifactKind`, `GraphData`, `WorktreeInfo`, `WorktreeSource`, `Heading` 等。`ChangeDetail.artifacts: ChangeArtifact[]` 是跨 core / API / adapters / 各前端的通用合約，change detail 的 tab、TOC 都由它驅動（markdown / specs 有 TOC、tasks 無）

### API Adapter Pattern
前端透過 `ApiAdapter` 介面抽象通訊層：
- `FetchAdapter` — Web 版 + IntelliJ 版，呼叫 REST API（支援自訂 `baseUrl` 和 `dirParam`）
- `MessageAdapter` — VS Code Webview 版，透過 `postMessage` 與 extension host 通訊
- `StaticAdapter` — Demo 版，從 build time 內嵌的 `window.__DEMO_DATA__` 讀取靜態資料
- 透過 `ApiAdapterContext` (React Context) 注入

### API endpoints（Web 版，所有 openspec routes 接受 `dir` query param）

`/changes`、`/overview`、`/graph`、`/watch` 另接受 `aggregate` query param（預設 true，跨 worktree 聚合；`aggregate=false` 關閉）。`/changes/:slug` 接受 `wt`（worktree key）以辨識同名 slug 的來源 worktree。

```
GET /api/fs/browse?path=...              # 目錄瀏覽
GET /api/fs/detect?path=...              # 偵測 openspec/ 存在
GET /api/openspec/overview?dir=...&aggregate=    # 總覽統計
GET /api/openspec/specs?dir=...          # Spec 列表
GET /api/openspec/specs/:topic?dir=...   # 單一 spec 內容
GET /api/openspec/specs/:topic/at/:slug?dir=...  # Spec 歷史版本內容（diff 用）
GET /api/openspec/changes?dir=...&aggregate=     # Changes 列表（聚合時回傳含 worktrees / aggregated）
GET /api/openspec/changes/:slug?dir=...&wt=      # 單一 change 內容（wt 指定來源 worktree）
GET /api/openspec/graph?dir=...&aggregate=       # Spec-Change 關聯圖資料
GET /api/openspec/search?dir=...&q=...   # 全文搜尋
```

### VS Code Extension
- `spek.open` / `spek.search` / `spek.navigateTo` commands（`spek.navigateTo` 接受含 `#hash` 的 route path）
- `workspaceContains:openspec/config.yaml` activation
- Webview Panel 載入 IIFE-bundled React app
- extension host 直接呼叫 `@spek/core` 處理 API requests
- Sidebar Specs TreeView 每個 spec 項目可展開，子節點為該 spec 的 h2/h3 heading，點擊跳到 webview 對應錨點

### IntelliJ Plugin
- Kotlin 開發，使用 IntelliJ Platform SDK
- JCEF（JetBrains 內建 Chromium）載入 React SPA 前端
- IntelliJ Built-in Server 提供 REST API（`/api/spek/openspec/*`，`projectPath` query param）
- Kotlin 重新實作 `@spek/core` 掃描/讀取邏輯（`core/` 目錄），含 artifact 動態探索與 mtime 排序（`ArtifactDiscovery.kt`）及 schema 權威順序（`SchemaOrder.kt`：`parseOrderFromStatus` / `resolveSchemaOrder` + CLI provider，`ChangeReader` 附上 `schemaOrder`），皆對齊 TS 版規則；單元測試見 `src/test/kotlin`
- 前端用 `FetchAdapter`（含自訂 `baseUrl` + `dirParam`）連接內嵌 server
- Tool Window 在 IDE 右側 sidebar 顯示
- 主題同步透過 JCEF `executeJavaScript()` 注入 CSS class
- 檔案監控透過 VFS BulkFileListener + 500ms debounce

**Frontend routes**: `/` (SelectRepo, web only) → `/dashboard` → `/specs` → `/specs/:topic` → `/changes` → `/changes/:slug` → `/graph`

## Key Design Decisions

- **安全**：Express 僅讀取 `openspec/` 子目錄內的 `.md`、`.yaml` 檔案，不暴露任意檔案
- **TypeScript**：前端 ESNext + JSX，後端 + core 用獨立 tsconfig
- **BDD 高亮**：WHEN/GIVEN (藍)、THEN (綠)、AND (灰)、MUST/SHALL (紅)、ADDED/MODIFIED (橘/藍 badge)
- **深色主題**：背景 #0a0c0f 系列，accent 琥珀色 #f59e0b，文字 #e2e8f0
- **tasks.md 解析**：`- [x]`/`- [ ]` checkbox + `##` section 分組，回傳 `{ total, completed, sections }`
- **Webview CSP**：IIFE 格式 + nonce script + unsafe-inline styles（Tailwind 需要）
- **acquireVsCodeApi**：只呼叫一次存到 `window.__vscodeApi`，MessageAdapter 從全域取得

## Conventions

- 程式碼用英文撰寫
- 註解與文件使用繁體中文（台灣用語）
- OpenSpec 資料結構詳見 `docs/prd.md` 第 3 節
- **CHANGELOG 同步**：root `CHANGELOG.md`、`packages/vscode/CHANGELOG.md` 與 `packages/intellij/CHANGELOG.md` 三份內容必須保持一致，更新時三邊同步修改

## Workflow

- **所有變更都必須使用 OpenSpec 工作流程**：每個功能、修復或修改都要先建立 OpenSpec change，經過 proposal → design → tasks 流程後再實作
- 使用 `/openspec-new-change` 建立新的 change
- 實作完成後使用 `/openspec-verify-change` 驗證，再用 `/openspec-archive-change` 封存
- **Archive 時必須**：更新相關文件（CLAUDE.md、README 等若有影響），並建立 git commit
