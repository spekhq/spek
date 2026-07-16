# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

spek 是一個 OpenSpec 內容檢視器，提供四種使用方式：
1. **Web 版**：本地唯讀 Web 應用（Express + React SPA），使用者啟動後在 UI 中選擇 repo 路徑瀏覽
2. **VS Code Extension**：直接在 VS Code 中開啟 Webview Panel 瀏覽當前 workspace 的 OpenSpec 內容
3. **IntelliJ Plugin**：在 IntelliJ IDEA 系列 IDE 中透過 Tool Window + JCEF 瀏覽 OpenSpec 內容
4. **Demo**：獨立靜態 HTML（`docs/demo.html`），內嵌 spek 自身的 openspec 資料，可部署至 GitHub Pages

## Repo 位置（`move-to-spekhq-org` 起）

本 repo 位於 **`spekhq/spek`**（原 `kewang/spek`）。GitHub org 為 `spekhq` —— 首選的 `spekjs`
（與 npm scope `@spekjs` 對齊）被一個閒置的 User 帳號佔著，開不出來。**npm scope 仍是 `@spekjs`，
不改**：GitHub org 名與 npm scope 不一致是常態（`@tailwindcss/*` 的源碼在 `tailwindlabs/tailwindcss`）。

> ### **`kewang/spek` 這個名字此後不可再被佔用。**
>
> GitHub 的 repo redirect 在此是**承重的**，而它在舊名被重新佔用的當下就會停用。兩件事靠它撐著：
>
> 1. **已發佈版本的 npm metadata。** `@spekjs/core@1.x` 等既有版本的 `repository` 欄位永遠指向
>    `kewang/spek`，**且無法修正**（已發佈的 tarball 不可變）。
> 2. **`action.yml` 的歷史 tag。** composite action 在執行期 `actions/checkout` 自己的原始碼；
>    舊 tag 上的那一行仍寫著舊位置，靠 redirect 解析。
>
> 在 `kewang/` 底下重建一個叫 `spek` 的 repo，會**同時**炸掉這兩者 —— 而且第二項的後果是：
> 使用者的 CI 會 checkout 一個**完全不同的 repo** 並執行它。這是一條供應鏈路徑。
>
> 同理，**Pages 的舊網址（`kewang.github.io/spek`）已永久失效**，GitHub 不 redirect Pages。
> 不要試圖用一個 stub repo 把它救回來 —— 那正是「重新佔用舊名」。

**搬遷的完整性以一次性 grep 驗收，沒有常駐守衛** —— 舊名沒有「重新流入」的來源（不會有人在新
程式碼裡寫 `kewang/spek`），一道常駐的檢查只會養出一份越來越長的排除清單（CHANGELOG、`openspec/`、
`docs/demo.html` 這類合法提到歷史的產生物）。要改動 `action.yml` 時，記得上面那段：**`repository:`
那一行殘留舊名不會壞**，它是這個 repo 唯一「錯了也全綠」的地方。

## `action.yml` 沒有任何自動化覆蓋 —— 動它之前先讀這段

**對外發佈的 composite action 是本 repo 唯一零測試覆蓋的出貨品。** `npm test` 完全碰不到它，
CI 也沒有任何 workflow 會跑它。這是**明知的取捨**，不是疏忽。

代價已經實現過一次：`fix-publish-workflow-install` 把 `@spekjs/ui` 的 build 從 `prepare`
（安裝期）移到 `prepublishOnly`（發佈期）。它修好了 VS Code 與 IntelliJ 的 pipeline —— 因為
`vscode-cicd` 與 `intellij-cicd` 各自都有一條 build chain requirement 逼它去對齊。**而 `action.yml`
是靠 `npm ci` 順手觸發 ui 的 `prepare` 才拿到 dist 的**，那個 hook 一沒，它的 ui build 就**靜默
消失**了 —— Marketplace 上的 action 壞了整整一天，沒有任何東西叫過一聲。

（`github-action` 現在有了 `Requirement: Action build chain`，但它**沒有自動驗收**，只是一段散文。）

> **因此：任何改動套件建置時機／建置鏈的 change，都必須手動驗一次 action。**
> 最快的方法是臨時加一支 `workflow_dispatch` 的 workflow，`uses: spekhq/spek@master` +
> `generate-badges: "true"`，斷言 `html-path` 與 `badges-path` 真的產出檔案，驗完移除。
> **注意 `spek-version` 預設是 `"master"`** —— 所以使用者即使 pin 了 `@v1`，建置仍走 master：
> master 一壞，所有人立刻壞，pin tag 救不了他們。

## Tech Stack

- **Core**: `@spekjs/core` — 共用邏輯（scanner、tasks parser、型別定義），純 Node.js。**已發佈至 npm public registry**，有獨立於 root 的版本線；唯一的 runtime 依賴是 `cross-spawn`。repo 內的 `packages/web` / `packages/vscode` 以 `"*"` 由 npm workspaces 解析到本地，不從 registry 抓，因此開發不受 core 發版節奏影響。
- **UI**: `@spekjs/ui` — 可重用的視覺化元件（`SpecGraph` 力導向圖、`ChangeTimeline` Gantt）。**同樣發佈至 npm**，供 repo 外的宿主使用。**元件是純呈現層**：資料由 props 進、選擇由回呼出，**沒有 router、沒有 adapter、沒有 CSS 框架** —— 因為宿主之間這三件事完全不同。顏色以 8 個 `--spek-*` CSS 變數表達（套件擁有自己的變數名，不讀宿主的 token；否則命名不同的宿主會得到一張沒有顏色的圖）。`packages/web` 的 `/graph` 與 `/timeline` 兩頁退為薄殼：取數、loading／error、導航、主題訊號。
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
├── core/       # @spekjs/core — 純邏輯，無框架依賴
│   └── src/    # scanner.ts, tasks.ts, git-cache.ts, types.ts
├── ui/         # @spekjs/ui — 可重用視覺化元件（純呈現層，無 router / adapter / CSS 框架）
│   └── src/    # SpecGraph.tsx, timeline/*, theme.ts（顏色契約）, styles.css
├── web/        # @spekjs/web — Express + React 應用
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
npm run build:core       # Build @spekjs/core
npm run build:web        # Build @spekjs/web（web 版 production build）
npm run build:webview    # Build webview assets（給 VS Code extension 用）
npm run build:vscode     # Build VS Code extension
npm run build:demo       # Build 獨立 demo HTML（docs/demo.html）
npm run build:intellij   # Build IntelliJ webview assets
npm run type-check       # TypeScript type check
npm run test -w @spekjs/core  # 跑 @spekjs/core 的 unit test（node:test + tsx）
```

**Web 開發**：`npm run dev` 後存取 http://localhost:5173

**VS Code Extension 打包**：
```bash
npm run build -w @spekjs/core && npm run build:webview -w @spekjs/web && npm run build -w spek-vscode
cd packages/vscode && npx vsce package --no-dependencies
```

**IntelliJ Plugin 打包**：
```bash
npm run build -w @spekjs/core && npm run build:intellij
cd packages/intellij && ./gradlew buildPlugin
# 產出: packages/intellij/build/distributions/spek-intellij-*.zip
```

## Architecture

### Core Module (`@spekjs/core`)
純函式 + 型別定義，可被 web server 和 extension host 共用：
- `scanOpenSpec(basePath)` — 掃描單一目錄的 OpenSpec 結構
- `scanOpenSpecAggregated(basePath, { aggregate })` — 跨 worktree 聚合掃描：探索同 repo 全部 worktree，active changes 聯集並附來源、archived 依 slug 去重、specs 取主 worktree；單一 worktree / 非 git / 關閉聚合時等同 `scanOpenSpec`
- `readSpec(basePath, topic)` — 讀取單一 spec（含歷史）
- `readChange(basePath, slug, orderProvider?)` — 讀取單一 change；回傳 `ChangeDetail`，內含動態探索的 `artifacts` 陣列（預設 mtime 序）、`schema` 與 `defaultSchema`（該 change 所在 worktree 的預設 schema，讀自 `openspec/config.yaml`，`scanOpenSpec` 每次掃描每個 worktree 只讀一次並共用給該 worktree 的所有 change；`defaultSchema` 同樣以每個 change 為單位暴露於 `ChangeInfo`，前端在 change schema 等於**自身** `defaultSchema` 時隱藏 schema badge，故跨 worktree 聚合時每個 change 對照自己 worktree 的基準、list 與 detail 一致；`ChangesData.defaultSchema` 則為主 worktree 基準，供 Changes 頁首的 `Default schema:` 顯示）、以及 `schemaOrder`（schema 權威順序的 artifact id 清單，供前端 schema-order 排序用；只對 active change 查 CLI，archived / CLI 不可用時為 undefined）。`orderProvider` 可注入以利測試
- `discoverArtifacts(changePath)` — 以檔案系統為準探索 change 的 artifacts：root 每個 `*.md`（忽略 dotfile / 非 md）為一個 artifact、非空 `specs/` 為一個 specs artifact，依 kind（`markdown` / `tasks` / `specs`）分類；排序依檔案 mtime 由新到舊（見下）。`countArtifacts(changePath)` 不讀內容算出數量供列表用
- **Artifact 預設 mtime 排序 + 使用者可選排序** — `artifacts.ts` 的 `discoverArtifacts` 以檔案 mtime 由新到舊排序（root 檔案取自身 mtime、`specs` 取其 delta 檔案中最新的 mtime），讓執行中被編輯的 artifact（如 tasks）浮到最前；mtime 相同時（例如剛 clone/checkout）以穩定的預設順序 tiebreak（`proposal, design, specs, tasks` 優先、其餘字母序）。**掃描（scanOpenSpec）永遠不呼叫 CLI**。前端提供排序控制（Last modified 預設 / Schema order / A–Z，mode id 分別為 `modified` / `schema` / `alpha`，偏好存於 `localStorage["spek:artifact-sort"]`，全域套用）：`modified` 用交付的 mtime 序、`alpha` 依標題、`schema` 依 `ChangeDetail.schemaOrder` 排序。`schemaOrder` 由 `readChange` 呼叫 `schema-order.ts` 的 `cliSchemaOrderProvider`（`openspec status --change <slug> --json` → `parseOrderFromStatus` 取 `planningArtifacts` + `artifactPaths`，`resolveSchemaOrder` 對應成 artifact id 清單）算出，**只在單一 change detail 讀取時查一次（有 cache），不進掃描熱路徑**；權威順序（`planningArtifacts` + `artifactPaths`）只由 change 的 schema 決定，故快取以 `${repoRoot}::${schema}` 為 key —— 同 repo 內共用該 schema 的所有 change 至多 spawn 一次 CLI，而非每個 change 一次（issue #15）。change **無 schema**（null / 空字串）時即無權威順序可言，`readChange` / `ChangeReader` 於呼叫端提前回 null、根本不查 CLI（故 provider 的 `schema` 參數恆為非空字串）；CLI 不可用或 archived change 時 `schemaOrder` 亦為 null，前端退回預設敘事序並顯示原因（active → CLI 未安裝、archived → 不追蹤 schema 順序）。change 顯示用的 schema 名稱仍從 `.openspec.yaml` `schema:` 讀取（fallback `openspec/config.yaml`），純讀 yaml key 非解析 schema
- `readSpecAtChange(basePath, topic, slug)` — 讀取特定 change 中的 spec 歷史版本
- `buildGraphData(basePath)` — 建立 spec-change 關聯圖資料
- `buildGraphDataAggregated(basePath, { aggregate })` — 跨 worktree 聚合的關聯圖（change 節點 id 以 `change:<worktreeKey>:<slug>` 命名避免碰撞）
- `listWorktrees(basePath)` — 以 `git worktree list --porcelain` 列出同 repo 全部 worktree；非 git / 無 `git` 時回 `[]`
- `shouldUsePolling(path, opts?)` / `pollingInterval(env?)` — 判定檔案監看是否該改用 polling（`watch-polling.ts`）。原生事件（inotify）在 9p/drvfs/NFS/CIFS 等掛載上不傳遞（devcontainer/WSL），故依「被監看路徑的 fstype」決定：純函式 `decidePolling` 套用優先序「明確覆寫（`SPEK_WATCH_POLLING`/`CHOKIDAR_USEPOLLING`）→ fstype 偵測（讀 `/proc/mounts`）→ remote 環境保底」。Web/VS Code 傳給 chokidar `usePolling`；IntelliJ 以 Kotlin 對齊版（`WatchPolling.kt`）在需要時改走輪詢掃描執行緒
- `parseTasks(content)` — 解析 tasks.md checkbox
- `extractHeadings(content)` / `slugifyHeading(text)` — 解析 markdown h2/h3 並產生穩定 slug，給 spec detail TOC 與 VS Code sidebar 共用（從 `@spekjs/core/headings` subpath 引入，避免 webview bundle 把 server-only 模組打包進去）
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
- extension host 直接呼叫 `@spekjs/core` 處理 API requests
- Sidebar Specs TreeView 每個 spec 項目可展開，子節點為該 spec 的 h2/h3 heading，點擊跳到 webview 對應錨點

### IntelliJ Plugin
- Kotlin 開發，使用 IntelliJ Platform SDK
- JCEF（JetBrains 內建 Chromium）載入 React SPA 前端
- IntelliJ Built-in Server 提供 REST API（`/api/spek/openspec/*`，`projectPath` query param）
- Kotlin 重新實作 `@spekjs/core` 掃描/讀取邏輯（`core/` 目錄），含 artifact 動態探索與 mtime 排序（`ArtifactDiscovery.kt`）及 schema 權威順序（`SchemaOrder.kt`：`parseOrderFromStatus` / `resolveSchemaOrder` + CLI provider，`ChangeReader` 附上 `schemaOrder`），皆對齊 TS 版規則；單元測試見 `src/test/kotlin`
- 前端用 `FetchAdapter`（含自訂 `baseUrl` + `dirParam`）連接內嵌 server
- Tool Window 在 IDE 右側 sidebar 顯示
- **Tool Window 佈局 + 樹狀面板可隱藏** — 內容是 `JBSplitter`（上：Specs/Changes 樹，下：JCEF webview）。用 `JBSplitter` 而非 `JSplitPane`：子元件 `isVisible = false` 時它會把空間全數讓給另一側並隱藏 divider，且 `proportionKey` 讓分隔線比例自動持久化（application 層級）。樹的顯示由 `ToggleTreePanelAction` 切換，同一個 action 實例同時掛在標題列（`setTitleActions`）與 ⋮ gear 選單（`setAdditionalGearActions`）。偏好存於 `SpekProjectState.treeVisible`，該 service 為 `PersistentStateComponent`，寫入 `.idea/workspace.xml`；`hasOpenSpec` 刻意留在 service 本體不進 `State`，否則移除 `openspec/` 的專案重開後會誤判。樹隱藏時 `TreeRefreshGate`（純邏輯，`synchronized`，可單測）把 file watcher 的刷新請求記為 pending 而不重建 model，重新顯示前才補建一次；初始即隱藏時連第一次磁碟掃描都跳過
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
- **宿主標記（全域旗標）**：VS Code 設 `window.__vscodeApi`（`acquireVsCodeApi` 只呼叫一次存到全域，MessageAdapter 從全域取得）、IntelliJ 設 `window.__spekIntellij`、Demo 設 `window.__DEMO_DATA__`。`useFileWatcher` 靠這三個旗標選擇刷新管道，**每個非 Web 宿主都必須有自己的旗標** —— IntelliJ 曾因為沒有旗標而被誤判為 Web，對 `/api/openspec/watch` 開 `EventSource`；IntelliJ 內建 server 只服務 `/api/spek/` 前綴，該路徑必然 404，於是它永遠重連、永遠失敗
- **刷新（`RefreshContext` + `refreshTracker.ts`）**：`refresh(manual)` 區分「使用者按下 Refresh」與「watcher 觸發的自動刷新」—— 只有前者 arm 忙碌狀態（自動刷新時憑空冒出 spinner 是噪音）。忙碌狀態必須撐到**重取的資料真正抵達**，而非 resync 那個 POST 回來就停：`useAsyncData` 每次 fetch 前後向 context 回報在途狀態，`refreshTracker` 以世代（generation）區分「這次刷新引發的 fetch」與「刷新前就已在途的 fetch」，並以 500ms 逾時保護避免沒有取數 hook 掛載時卡死。狀態機是與 React 無關的純邏輯，故可單測（同 `TreeRefreshGate` / `decidePolling` 的慣例）
- **Refresh 的核心不變式**：**快取失效（resync）失敗不得阻擋重新取數**。resync 是 best-effort —— 宿主可能沒有這個端點、或沒有任何快取需要失效。此保證寫死在 `runManualRefresh` 單一位置，不在呼叫端拼裝：IntelliJ 缺 resync 路由時的一個 404，就足以讓整顆按鈕啞掉（issue #18）。resync 的語意是「讓**本宿主實際持有**、可能供出陳舊視圖的伺服端狀態失效」，不是「執行某一組固定動作」—— Web / VS Code 清 git timestamp 快取，IntelliJ 沒有該快取（`timestamp` 恆為 `null`）故清 schema-order 快取
- **live-update 斷線只在壞掉時出聲**：`liveStatus`（`live` / `offline` / `unsupported`）由 `useFileWatcher` 回報，sidebar 僅在 `offline` 時顯示提示。不做常駐的「正常」指示燈 —— 永遠亮著的燈是純噪音，還會鈍化真正出事時的訊號。VS Code / IntelliJ 的刷新管道沒有可觀測的失敗訊號，一律回報 `live`（謊報 offline 比不報更糟）

## Conventions

- 程式碼用英文撰寫
- 註解與文件使用繁體中文（台灣用語）
- OpenSpec 資料結構詳見 `docs/prd.md` 第 3 節
- **CHANGELOG（兩條版本線）**：
  - **spek 產品**（Web / VS Code / IntelliJ 三個發行通道，共用 root `package.json` 的版本）由 root `CHANGELOG.md`、`packages/vscode/CHANGELOG.md`、`packages/intellij/CHANGELOG.md` 三份記錄。三者**共享同一份版本歷史，但各自過濾掉與該發行通道無關的條目**（例如純 Web 的變更不出現在 vscode / intellij 那兩份）。root 那份是超集，更新時以它為準向下過濾。
  - **`@spekjs/core`** 是獨立發佈到 npm 的套件，有自己的版本線與自己的 `packages/core/CHANGELOG.md`，**不寫進上述三份**。它的讀者是 API 消費者，關心的是函式簽章而非產品 UI 變更。該檔須列在 `packages/core/package.json` 的 `files` 中 —— npm 只會自動打包 `package.json` / `README` / `LICENSE`，不含 `CHANGELOG.md`。

## Workflow

- **所有變更都必須使用 OpenSpec 工作流程**：每個功能、修復或修改都要先建立 OpenSpec change，經過 proposal → design → tasks 流程後再實作
- 使用 `/openspec-new-change` 建立新的 change
- 實作完成後使用 `/openspec-verify-change` 驗證，再用 `/openspec-archive-change` 封存
- **Archive 時必須**：更新相關文件（CLAUDE.md、README 等若有影響），並建立 git commit
