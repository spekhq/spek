<p align="center">
  <img src="logo/full-logo.svg" alt="spek" width="480" />
</p>

<p align="center">
  輕量級的 <a href="https://github.com/Fission-AI/OpenSpec">OpenSpec</a> 內容檢視器 — 結構化瀏覽 specs、changes 與 tasks。
</p>

<p align="center">
  <img alt="Specs" src="https://spekhq.github.io/spek/badges/specs.svg" />
  <img alt="Open Changes" src="https://spekhq.github.io/spek/badges/open_changes.svg" />
  <img alt="Tasks" src="https://spekhq.github.io/spek/badges/tasks.svg" />
</p>

**[English](README.md)**

---

## spek 是什麼？

**spek** 把 repo 裡的 `openspec/` 目錄變成可以瀏覽的介面：spec 以大綱呈現，change 的 proposal、design、
tasks 與 delta spec 各自成為分頁，另有 workflow schema、關聯圖、時間軸與全文搜尋。它只讀不寫，不會改動任何檔案。

- **[線上 Demo](https://spekterm.com/spek/demo/)** —— spek 呈現自己的 OpenSpec，直接在瀏覽器體驗，免安裝。
- **[官網](https://spekterm.com/zh-tw/spek/)** 與 **[使用說明](https://spekterm.com/zh-tw/spek/docs/)** —— 有英文與繁體中文。

![Change 詳細](screenshots/change-detail.png)

## 重點功能

- **Dashboard** —— spec 與 change 數量、任務完成率、平均生命週期，以及停滯的 change
- **Specs** —— 以資料夾樹呈現，巢狀結構與 `openspec/specs/` 在磁碟上一致；spec 打開是一張大綱，
  requirement 與 scenario 就地摺疊，並附 git 修訂歷史
- **Changes** —— 進行中與已封存，change 裡有幾個 artifact 就有幾個分頁，不論它用哪個 schema 撰寫
- **Schemas、關聯圖、時間軸** —— 每個 workflow schema 畫成流程、spec 與 change 的關係、每個 change
  的生命週期畫在 Gantt 風格的圖上
- **Worktree 聚合** —— 所有 git worktree 進行中的 change 合併成一份去重的清單（jj workspace 為實驗性
  選項）—— 為平行工作的 agent 而生
- **BDD 語法高亮、任務進度、`Cmd+K` / `Ctrl+K` 搜尋、深色與淺色主題**

各畫面的說明：[瀏覽](https://spekterm.com/zh-tw/spek/docs/using/browsing/) ·
[Worktree 聚合](https://spekterm.com/zh-tw/spek/docs/using/worktrees/)。

## 四種使用方式

四種呈現的畫面都一樣，全部唯讀。前三者純本地運作：不需要部署伺服器、不需要帳號，repo 的內容不會離開你的電腦
（[資料與網路](https://spekterm.com/zh-tw/spek/docs/reference/data-and-network/)）。

| 形式 | 取得 |
|---|---|
| **VS Code extension** —— 編輯器裡的 panel 與側邊欄 | [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=kewang.spek-vscode) |
| **JetBrains plugin** —— IntelliJ IDEA、WebStorm、PyCharm 等 JetBrains IDE 裡的 tool window | [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/30600-spek--openspec-viewer) |
| **Web 版** —— 從本 repo 的原始碼執行，在瀏覽器裡使用 | 見下方 |
| **GitHub Action** —— 在 CI 中建置 spek 靜態頁面與狀態徽章 | [GitHub Marketplace](https://github.com/marketplace/actions/spek-openspec-static-site)，見下方 |

各形式的安裝步驟、指令與設定：[安裝 spek](https://spekterm.com/zh-tw/spek/docs/getting-started/install/)。

### Web 版

```bash
git clone https://github.com/spekhq/spek.git
cd spek
npm install
npm run dev
```

開啟 http://localhost:5173，輸入包含 `openspec/` 目錄的 repo 路徑，即可開始瀏覽。

### GitHub Action

```yaml
- uses: actions/checkout@v7
  with:
    fetch-depth: 0  # 取得完整 git history，change 的日期才正確

- uses: spekhq/spek@v1
  with:
    title: "My Project - OpenSpec"
```

| Input | 說明 | 預設值 |
|-------|------|--------|
| `repo-path` | 包含 `openspec/` 的 repo 路徑 | `.` |
| `output-path` | 輸出的 HTML 檔案路徑 | `spek-output/spek.html` |
| `title` | 頁面標題 | `OpenSpec Viewer` |
| `spek-version` | spek 版本（tag、branch 或 SHA） | `master` |
| `generate-badges` | 產生 SVG 徽章檔案 | `false` |

| Output | 說明 |
|--------|------|
| `html-path` | 產生的 HTML 檔案絕對路徑 |
| `badges-path` | 產生的徽章目錄絕對路徑 |

把頁面部署到 GitHub Pages、把徽章放進 README：[GitHub Action 與徽章](https://spekterm.com/zh-tw/spek/docs/using/github-action/)。

### 容器環境的即時重載（devcontainer / WSL）

spek 會監看 `openspec/` 並在變更時重載。在不傳遞原生檔案事件的檔案系統上 —— 9p / drvfs / NFS / CIFS
掛載，devcontainer 與 WSL 即如此 —— 它會自動改用 polling。要覆寫：`SPEK_WATCH_POLLING=on`（或 `off`）
對所有形式有效；Web 版與 VS Code 另外尊重 chokidar 的 `CHOKIDAR_USEPOLLING=1` / `CHOKIDAR_INTERVAL=<ms>`。

## spek 與 spekterm

[spekterm](https://github.com/spekhq/spekterm) 是 spek 的姊妹專案，出自同一群維護者：一個桌面工作台，
在同一個視窗裡為你的每個 repo 跑 Claude Code session，並把每個 session 正在處理的 OpenSpec change
直接顯示在終端機旁邊。它的側欄是站在 spek 的成果上：

- **讀懂 OpenSpec 的引擎** —— 掃描 spec 與 change、task 進度、worktree 聚合，都來自
  [`@spekjs/core`](https://www.npmjs.com/package/@spekjs/core)。
- **關係圖與時間軸** —— 和 spek 畫的是同一套元件，來自 [`@spekjs/ui`](https://www.npmjs.com/package/@spekjs/ui)。

想在平常工作的地方讀 spec —— 瀏覽器、編輯器、CI —— 用 spek；要在多個 repo 之間駕駛 agent、讓 spec 待在
旁邊，用 spekterm。兩者讀的是同一批檔案，誰也不需要誰。兩者的官網都在 [spekterm.com](https://spekterm.com/zh-tw/)。

## 參與貢獻

歡迎各種形式的貢獻 —— 從修正錯字到跨 Web / VS Code / IntelliJ 的新功能。請先閱讀
[Contributing Guide](CONTRIBUTING.md)，裡面有開發環境設定、慣例，以及送出 PR 的流程。

- [Contributing Guide](CONTRIBUTING.md) —— 開發環境、慣例、如何送 PR
- [Code of Conduct](CODE_OF_CONDUCT.md) —— 行為準則
- [Security Policy](SECURITY.md) —— 如何私下回報安全漏洞

repo 的結構與建置方式，以及發佈到 npm 的兩個套件，也都寫在 Contributing Guide 裡。

## 致謝

本專案的靈感來自[龍哥（高見龍）](https://kaochenlong.com)介紹 SDD（Spec Driven Development）的系列文章。特別感謝龍哥在 SDD 和 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 上的貢獻。

- [SDD — Spec Driven Development](https://kaochenlong.com/sdd-spec-driven-development)
- [Spectra with OpenSpec](https://kaochenlong.com/spectra-with-openspec)

## 貢獻者

感謝所有為 spek 貢獻的人：

- [@nthansen](https://github.com/nthansen)（Norman Hansen）
  - **自訂 schema 支援** —— 從磁碟探索 change 的 artifact，任何 schema 的 artifact 都能各自成為分頁；每個 change 的 schema badge 對照自己所在 worktree 的預設判斷，分頁可依最後修改 / Schema order / A–Z 排序，其中權威順序取自 OpenSpec CLI 並以 schema 為單位快取
  - **非 Markdown artifact** —— change 根目錄的 `.yaml` / `.yml` / `.json` 各自成為語法高亮的分頁，依 schema 宣告的位置排序，計入 changes 列表的數量並可被搜尋；Markdown artifact 內的程式碼區塊也走同一條高亮管線
  - **Schemas 頁面** —— 列出每個可用 schema 定義了什麼，詳情頁把一份 schema 畫成可讀的流程，包含只在實作之後才產出的步驟
  - **Markdown 呈現的忠實度** —— task 的續行不再被 parser 丟棄，改以 Markdown 呈現；清單的項目符號與編號留在項目首行；TOC 與 `#hash` 導覽把目標標題落在 sticky header 下方
  - **平台涵蓋** —— 無原生檔案事件的檔案系統（devcontainer / WSL / 網路掛載）改用 polling 即時重載，建置指令在 Windows `cmd.exe` 下也能運作
  - **移除 web server 中未被引用的 `server/lib/`** 核心掃描邏輯副本 —— 它是 `@spekjs/core` 之外的第二份同規則實作，會成為漂移的溫床

- [@david-lutz](https://github.com/david-lutz)（David Lutz）
  - Changes 列表與關聯圖中，跨 git worktree 共用的 active change 去重 —— 勝出的副本以 git 分歧選舉決定，而非檔案時間戳（fresh checkout 會把它整個重寫掉）

- [@DannyGoodall](https://github.com/DannyGoodall)（Danny Goodall）
  - 實驗性的 Jujutsu（jj）workspace 聚合 —— 在 jj workspace 撰寫、對 `git worktree list` 隱形的 change 也能被探索並併入聚合畫面，以內容去重，分歧的副本則保留並加上標示

- [@Katsz](https://github.com/Katsz)（Alex）
  - Spec 差異檢視中，新增／刪除行的紅綠底色鋪滿整個橫向捲動範圍 —— 過長的行不再只有第一個畫面寬度有底色

- [@flatrick](https://github.com/flatrick)（Patrik）
  - 巢狀 spec 資料夾 —— `openspec/specs/` 底下任意深度的 `spec.md` 都依 OpenSpec 自己的規則被探索，在各介面以資料夾樹瀏覽；每次讀取 spec 都只限於掃描列出的那些
  - `verify-vscode` skill，在真正的 VS Code 視窗裡檢查 spek —— 讀取、點擊並截圖面板與側邊欄實際呈現的內容，桌面版與瀏覽器版 VS Code 皆可

- [@gokul-kulkarni](https://github.com/gokul-kulkarni)（Gokul Kulkarni）
  - **Mermaid 圖表** —— 任何 Markdown artifact 裡的 ` ```mermaid ` 區塊，以及 change 根目錄的 `.mmd` / `.mermaid` 檔，都會畫成圖，配色取自 spek 的主題，可縮放、拖曳與檢視原始碼；無法解析的圖會在原始碼旁顯示錯誤

- [@sammcj](https://github.com/sammcj)（Sam McLeod）
  - 關聯圖的標籤不再壓在其他節點上 —— 版面為每個標籤留出空間，寬視窗會橫向鋪開，每次載入的排列都一樣
  - 頁面宣告的語言改為英文，瀏覽器不再提示翻譯，備用字型也選得正確

## 授權

MIT
