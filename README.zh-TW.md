<p align="center">
  <img src="logo/full-logo.svg" alt="spek" width="480" />
</p>

<p align="center">
  輕量級的 <a href="https://github.com/Fission-AI/OpenSpec">OpenSpec</a> 內容檢視器 — 結構化瀏覽 specs、changes 與 tasks。
</p>

<p align="center">
  <img alt="Specs" src="https://kewang.github.io/spek/badges/specs.svg" />
  <img alt="Open Changes" src="https://kewang.github.io/spek/badges/open_changes.svg" />
  <img alt="Tasks" src="https://kewang.github.io/spek/badges/tasks.svg" />
</p>

**[English](README.md)**

---

## spek 是什麼？

**spek** 把你本機的 OpenSpec 目錄變成可瀏覽、可搜尋的介面。不用再打開一堆 Markdown 檔案逐一閱讀，spek 提供結構化的瀏覽體驗，包含 BDD 語法高亮、任務進度追蹤和全文搜尋。

**[線上 Demo](https://kewang.github.io/spek/demo.html)** — 直接在瀏覽器體驗，免安裝。

提供三種使用方式：

- **Web 版** — 本地 Express + React 應用，瀏覽器即可使用
- **VS Code Extension** — 直接在 VS Code 內開啟 Webview Panel 瀏覽
- **IntelliJ Plugin** — 在 IntelliJ IDEA 系列 IDE 中透過 JCEF Tool Window 瀏覽

三者皆為**唯讀**且**純本地**運作。不需要部署伺服器、不需要登入、資料不會離開你的電腦。

## 功能特色

- **Dashboard 總覽** — Specs 數量、Changes 數量、任務完成率一覽，加上生命週期統計（已封存 change 平均週期、超過 30 天未封存的 stale active）
- **Specs 瀏覽** — 依字母排序的主題列表，含詳細內容與修訂歷史
- **Changes 瀏覽** — 進行中與已封存的 changes，分頁顯示 Proposal / Design / Tasks / Specs；每筆 row 顯示建立日期、封存日期與生命週期天數
- **Git Worktree 聚合** — 自動探索 repo 的所有 git worktree，把各 worktree 進行中的 change 合併到單一畫面 —— 為 AI agent 平行開發時代而生
- **Timeline 時間軸** — 用水平 Gantt 風格圖呈現所有 change 的生命週期，可依 spec topic 分群、依狀態過濾，時間軸刻度依跨度自動切換
- **BDD 語法高亮** — WHEN/GIVEN（藍）、THEN（綠）、AND（灰）、MUST/SHALL（紅）關鍵字上色
- **任務進度** — 解析 checkbox，依章節分組顯示進度條
- **全文搜尋** — `Cmd+K` / `Ctrl+K` 跨 specs 與 changes 搜尋
- **深色 / 淺色主題** — 可切換，預設深色主題
- **Spec 歷史追蹤** — 基於 Git 的時間戳記追蹤 spec 修訂紀錄
- **響應式版面** — 適應不同螢幕尺寸
- **VS Code 側邊欄** — Activity Bar icon + TreeView，直接從側邊欄瀏覽 specs 與 changes

## Git Worktree 聚合

在 AI agent 開發的時代，同一個 repo 經常**同時開著多個 git worktree** —— 每個 agent、或每個平行任務，各自在自己的 worktree、自己的分支上進行。這些工作的 OpenSpec change 會散落在各個 worktree 裡，把檢視工具指向單一目錄，只看得到其中一部分。

spek 會探索 repo 的每一個 worktree（透過 `git worktree list`），把**各 worktree 進行中的 change 聚合到同一個畫面**。指向任一 worktree、或主 repo，都能看到全貌：

- **所有 worktree 的 active changes**，每筆標示來源分支
- **archived changes** 跨 worktree 合併、依 slug 去重
- **聚合開關**（偵測到多個 worktree 時自動開啟）；來自主 worktree 的 change 不加標籤，讓 feature worktree 的工作一眼凸顯
- **Web 版**與 **VS Code extension**（panel + 側邊欄）皆支援，任一 worktree 的 `openspec/` 變動都會即時刷新

![Git Worktree 聚合](screenshots/worktree-aggregation.png)

## 快速開始

### Web 版

```bash
git clone https://github.com/kewang/spek.git
cd spek
npm install
npm run dev
```

開啟 http://localhost:5173，輸入包含 `openspec/` 目錄的 repo 路徑，即可開始瀏覽。

> `npm install` 會編譯共用的 `@spek/core` 套件，`npm run dev` 啟動前也會重新 build，因此 fresh clone 不需額外手動 build 即可啟動。

### VS Code Extension

從 [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=kewang.spek-vscode) 安裝。當 workspace 包含 `openspec/config.yaml` 時，Extension 會自動啟動。

啟動後，點擊 Activity Bar 上的 **spek icon** 即可從側邊欄瀏覽 specs 與 changes。點擊任一項目會開啟完整的檢視器面板。

**指令：**
- `spek: Open spek` — 開啟檢視器面板
- `spek: Search OpenSpec` — 開啟搜尋對話框
- `spek: Open Dashboard` — 從側邊欄開啟 Dashboard

### IntelliJ Plugin

從 [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/30600-spek--openspec-viewer) 安裝 — 在 **Settings > Plugins > Marketplace** 搜尋 **「spek」** 即可。

當專案包含 `openspec/` 目錄時，Plugin 會自動啟用。點擊右側 sidebar 的 **spek** 圖示即可開啟檢視器。

**指令：**
- **Tools > Open spek** — 開啟檢視器面板

## 截圖

### Dashboard 總覽
Specs 數量、Changes 數量、任務完成率一覽。

![Dashboard](screenshots/dashboard.png)

### Specs 瀏覽
依字母排序的主題列表，支援篩選。

![Specs 列表](screenshots/specs-list.png)

### Spec 詳細內容 — BDD 語法高亮
BDD 關鍵字上色 — WHEN/GIVEN（藍）、THEN（綠）、AND（灰）、MUST/SHALL（紅）。

![Spec 詳細](screenshots/spec-detail.png)

### Changes 瀏覽
進行中與已封存的 changes 依時間排列，每筆 row 顯示生命週期天數。

![Changes 列表](screenshots/changes-list.png)

### Timeline 時間軸
水平 Gantt 風格呈現所有 change 的生命週期 — active 的 bar 延伸到今天，archived 為固定區段。

![Timeline](screenshots/timeline.png)

### Change 詳細內容
分頁顯示 Proposal、Design、Tasks、Specs。

![Change 詳細](screenshots/change-detail.png)

### 全文搜尋
`Cmd+K` / `Ctrl+K` 跨 specs 與 changes 搜尋。

![搜尋](screenshots/search.png)

## GitHub Action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-spek-blue?logo=github)](https://github.com/marketplace/actions/spek-openspec-static-site)

使用 spek GitHub Action 在 CI 中自動建置 OpenSpec 靜態網站。

### 基本用法

```yaml
- uses: actions/checkout@v7
  with:
    fetch-depth: 0  # 建議取得完整 git history 以取得正確的 change timestamps

- uses: kewang/spek@v1
  with:
    title: "My Project - OpenSpec"
```

### 部署到 GitHub Pages

```yaml
name: Build OpenSpec Site
on:
  push:
    branches: [main]
    paths: ["openspec/**"]

permissions:
  pages: write
  id-token: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - uses: kewang/spek@v1
        with:
          title: "My Project - OpenSpec"

      - uses: actions/upload-pages-artifact@v5
        with:
          path: spek-output

      - name: Deploy to GitHub Pages
        id: deploy
        uses: actions/deploy-pages@v5
```

### Inputs

| Input | 說明 | 預設值 |
|-------|------|--------|
| `repo-path` | 包含 `openspec/` 目錄的 repo 路徑 | `.` |
| `output-path` | 輸出 HTML 檔案路徑 | `spek-output/spek.html` |
| `title` | 頁面標題 | `OpenSpec Viewer` |
| `spek-version` | spek 版本（tag、branch 或 SHA） | `master` |
| `generate-badges` | 產生 SVG badge 檔案 | `false` |

### Outputs

| Output | 說明 |
|--------|------|
| `html-path` | 產出 HTML 檔案的絕對路徑 |
| `badges-path` | 產出 badge 目錄的絕對路徑 |

### Badges

啟用 `generate-badges` 可在建置靜態網站時一併產生 SVG 狀態徽章（specs 數量、open changes 數量、tasks 完成率）。部署到 GitHub Pages 後即可在 README 中引用：

```yaml
- uses: kewang/spek@v1
  with:
    title: "My Project - OpenSpec"
    generate-badges: true
```

在 README 中引用：

```markdown
![Specs](https://your-user.github.io/your-repo/badges/specs.svg)
![Open Changes](https://your-user.github.io/your-repo/badges/open_changes.svg)
![Tasks](https://your-user.github.io/your-repo/badges/tasks.svg)
```

> **注意：** 建議在 checkout 步驟使用 `fetch-depth: 0` 以取得正確的 change timestamps。若無完整 git history，timestamps 將不可用（build 仍會成功）。

## OpenSpec 目錄結構

spek 預期你的 repo 底下有以下結構：

```
{repo}/openspec/
├── config.yaml
├── specs/
│   └── {topic}/
│       └── spec.md              # BDD 格式的規格文件
└── changes/
    ├── {active-change}/         # 進行中的變更
    │   ├── .openspec.yaml
    │   ├── proposal.md
    │   ├── design.md
    │   ├── tasks.md
    │   └── specs/               # 該變更的 delta specs
    └── archive/
        └── {YYYY-MM-DD-desc}/   # 已封存的變更（同樣結構）
```

## 架構

### Monorepo 結構

```
packages/
├── core/       # @spek/core — 純邏輯（掃描器、解析器、型別定義）
├── web/        # @spek/web — Express API + React SPA
├── vscode/     # spek-vscode — VS Code Extension
└── intellij/   # spek-intellij — IntelliJ Platform Plugin（Kotlin）
```

### API Adapter 模式

前端透過 `ApiAdapter` 介面與後端溝通，有兩種實作：

- **FetchAdapter** — Web 版 + IntelliJ 版，透過 HTTP 呼叫 REST API（支援自訂 base URL）
- **MessageAdapter** — VS Code 版，透過 `postMessage` 與 Extension Host 通訊

同一套 React UI 不需改動程式碼就能在三種環境運作。

### 技術棧

| 層面 | 技術 |
|------|------|
| Core | TypeScript, Node.js |
| 前端 | React 19, Vite 6, Tailwind CSS v4, React Router v7 |
| 後端 | Express 4 |
| Markdown 渲染 | react-markdown, remark-gfm |
| 搜尋 | Fuse.js |
| VS Code Extension | VS Code Webview API, esbuild |
| IntelliJ Plugin | Kotlin, JCEF, IntelliJ Platform SDK |

## 開發

```bash
npm install              # 安裝所有 workspace 依賴
npm run dev              # 啟動 Vite (5173) + Express (3001)
npm run build            # Build core + web
npm run build:core       # 僅 Build @spek/core
npm run build:webview    # Build webview 靜態資源（給 VS Code Extension 用）
npm run build:vscode     # Build VS Code Extension
npm run build:intellij   # Build IntelliJ webview 靜態資源
npm run type-check       # TypeScript 型別檢查
```

**IntelliJ Plugin build：**
```bash
npm run build:intellij                    # Build 前端靜態資源
cd packages/intellij && ./gradlew buildPlugin  # Build plugin ZIP
```

**系統需求：** Node.js 22+、Java 17+（IntelliJ plugin build 需要）

### 容器環境的即時重載（devcontainer / WSL）

spek 會監看 `openspec/` 並在檔案變更時即時重載。在不傳遞原生檔案事件的檔案系統上 —— 9p / drvfs / NFS / CIFS 等掛載（devcontainer、WSL 把 host 目錄掛進容器即如此）—— spek 會自動改用 polling，確保新建檔案仍能被偵測。判別依據是被監看路徑所在掛載的檔案系統型別。可用環境變數覆寫：

- `SPEK_WATCH_POLLING=on`（或 `off`）—— 對所有版本強制開啟 / 關閉 polling
- `CHOKIDAR_USEPOLLING=1` / `CHOKIDAR_INTERVAL=<ms>` —— Web 與 VS Code 另外尊重 chokidar 原生環境變數

## 致謝

本專案的靈感來自[龍哥（高見龍）](https://kaochenlong.com)介紹 SDD（Spec Driven Development）的系列文章。特別感謝龍哥在 SDD 和 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 上的貢獻。

- [SDD — Spec Driven Development](https://kaochenlong.com/sdd-spec-driven-development)
- [Spectra with OpenSpec](https://kaochenlong.com/spectra-with-openspec)

## 授權

MIT
