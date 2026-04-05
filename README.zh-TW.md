<p align="center">
  <img src="logo/full-logo.svg" alt="spek" width="480" />
</p>

<p align="center">
  輕量級的 <a href="https://github.com/Fission-AI/OpenSpec">OpenSpec</a> 內容檢視器 — 結構化瀏覽 specs、changes 與 tasks。
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

- **Dashboard 總覽** — Specs 數量、Changes 數量、任務完成率一覽
- **Specs 瀏覽** — 依字母排序的主題列表，含詳細內容與修訂歷史
- **Changes 時間線** — 進行中與已封存的 changes，分頁顯示 Proposal / Design / Tasks / Specs
- **BDD 語法高亮** — WHEN/GIVEN（藍）、THEN（綠）、AND（灰）、MUST/SHALL（紅）關鍵字上色
- **任務進度** — 解析 checkbox，依章節分組顯示進度條
- **全文搜尋** — `Cmd+K` / `Ctrl+K` 跨 specs 與 changes 搜尋
- **深色 / 淺色主題** — 可切換，預設深色主題
- **Spec 歷史追蹤** — 基於 Git 的時間戳記追蹤 spec 修訂紀錄
- **響應式版面** — 適應不同螢幕尺寸
- **VS Code 側邊欄** — Activity Bar icon + TreeView，直接從側邊欄瀏覽 specs 與 changes

## 快速開始

### Web 版

```bash
git clone https://github.com/kewang/spek.git
cd spek
npm install
npm run dev
```

開啟 http://localhost:5173，輸入包含 `openspec/` 目錄的 repo 路徑，即可開始瀏覽。

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

### Changes 時間線
進行中與已封存的 changes 依時間排列。

![Changes 列表](screenshots/changes-list.png)

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
- uses: actions/checkout@v4
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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: kewang/spek@v1
        with:
          title: "My Project - OpenSpec"

      - uses: actions/upload-pages-artifact@v3
        with:
          path: spek-output

      - name: Deploy to GitHub Pages
        id: deploy
        uses: actions/deploy-pages@v4
```

### Inputs

| Input | 說明 | 預設值 |
|-------|------|--------|
| `repo-path` | 包含 `openspec/` 目錄的 repo 路徑 | `.` |
| `output-path` | 輸出 HTML 檔案路徑 | `spek-output/spek.html` |
| `title` | 頁面標題 | `OpenSpec Viewer` |
| `spek-version` | spek 版本（tag、branch 或 SHA） | `master` |

### Outputs

| Output | 說明 |
|--------|------|
| `html-path` | 產出 HTML 檔案的絕對路徑 |

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

## 致謝

本專案的靈感來自[龍哥（高見龍）](https://kaochenlong.com)介紹 SDD（Spec Driven Development）的系列文章。特別感謝龍哥在 SDD 和 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 上的貢獻。

- [SDD — Spec Driven Development](https://kaochenlong.com/sdd-spec-driven-development)
- [Spectra with OpenSpec](https://kaochenlong.com/spectra-with-openspec)

## 授權

MIT
