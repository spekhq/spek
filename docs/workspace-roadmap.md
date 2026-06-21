# spek Workspace — 擴充規劃藍圖

> 狀態：規劃中（draft）
> 目標：把「以 agent 為核心的本地工作流」收斂成一個獨立的 Electron 桌面 app（`@spek/workspace`），重用 spek 既有核心，讓使用者不必另外開 IDE。

---

## 1. 願景與定位

把日常工作流（瀏覽多個專案、看/改檔案、跑 agent）全部收進一個 app：

- **左側活動列**：在 Explorer 與既有 spek 視圖（Dashboard / Specs / Changes / Graph）之間切換。
- **多 folder 工作區**：可隨意加入/移除多個 folder，狀態持久化。
- **File explorer + 可編輯主區**：選檔後在主區以 Monaco 開啟，支援 syntax highlight 與編輯存檔。
- **Terminal**：底部 dock，可開多個，是跑 agent（如 `claude`）的主場。
- **既有 spek 內容整合**：OpenSpec 的 spec/change/graph 以 tab 形式與一般檔案並存於同一主區。

定位上這是**全新、獨立的 app**，與現有四個型態（Web / VS Code / IntelliJ / Demo）平行，不取代它們；僅在程式碼層面重用 `@spek/core` 與部分前端元件。

---

## 2. 架構總覽

### 為什麼選 Electron 而非 Web 版延伸

| 需求 | Electron 的優勢 |
|------|----------------|
| Terminal（PTY） | 主行程是 Node，可直接 `node-pty` spawn shell，透過 IPC 串流，不需另架 WebSocket server |
| 讀寫任意檔案 | 桌面 app 的信任模型本就允許，不像 Web 版需處理沙盒/CORS/localhost 綁定 |
| 重用 `@spek/core` | core 是純 Node.js，主行程可直接 import，無需 HTTP 中介層 |
| 重用 spek 前端 | renderer 是標準 React + Vite，沿用 spek 的 React 19 / Tailwind v4 技術棧 |

### 三層結構

```
@spek/workspace
├── main/        # Electron 主行程（Node）
│   ├── window.ts          # 視窗 / 選單 / 生命週期
│   ├── ipc/               # IPC handlers
│   │   ├── fs.ts          # 讀目錄 / 讀檔 / 寫檔 / 監看（重用 @spek/core）
│   │   ├── terminal.ts    # node-pty 管理（多 session）
│   │   └── openspec.ts    # 呼叫 @spek/core scanner / reader
│   ├── workspace-store.ts # 多 folder 設定持久化（userData JSON）
│   └── watcher.ts         # chokidar 檔案監控 → IPC push
├── preload/     # contextBridge：把 IPC 包成 type-safe API 暴露給 renderer
└── renderer/    # React app（重用 spek 前端）
    ├── shell/             # 活動列 / 三欄 layout / split panes
    ├── explorer/          # 多 folder 檔案樹
    ├── tabs/              # 全域 tab manager（檔案 + spek 視圖共用）
    ├── editor/            # Monaco wrapper
    ├── terminal/          # xterm.js wrapper
    └── adapter/IpcAdapter # 實作 spek 的 ApiAdapter 介面（走 IPC）
```

### 技術選型

| 用途 | 選擇 | 備註 |
|------|------|------|
| App framework | **Electron** + **electron-vite** | electron-vite 整合 Vite，與 spek 既有建置一致 |
| 打包 | **electron-builder** | 產出 mac / win / linux |
| 編輯器 | **Monaco Editor** | 即 VS Code 的編輯器，syntax highlight 與 IntelliSense 最完整；需處理 Vite worker 設定 |
| Terminal UI | **@xterm/xterm** | 搭配 fit / web-links addon |
| PTY | **node-pty** | native 模組，需 `electron-rebuild` 對齊 Electron ABI |
| 檔案監控 | **chokidar** | spek 已用，主行程沿用 |
| 設定持久化 | **electron-store** 或 userData JSON | 多 folder、開啟的 tab、layout |
| UI 技術棧 | React 19 + Tailwind v4 + react-markdown | 與 spek 完全一致，最大化重用 |

> 編輯器替代方案：若覺得 Monaco 太重或 Vite worker 設定麻煩，可改 **CodeMirror 6**（更輕、Vite 整合更單純，syntax highlight 同樣完整）。建議先以 Monaco 做技術驗證，視打包大小再定。

---

## 3. 與既有 spek 的關係（重用什麼 / 不動什麼）

### 直接重用
- **`@spek/core`**：scanner、tasks、headings、git-cache、worktrees、types — 主行程直接 import。
- **spek 的 `ApiAdapter` 抽象**：spek 前端早已把通訊層抽象成 `ApiAdapter`（Fetch / Message / Static）。Workspace 只要新增一個 **`IpcAdapter`**，既有 spek 頁面（Dashboard / SpecDetail / ChangeDetail / GraphView）幾乎可原封不動在 Electron renderer 跑起來。這是整合既有畫面的關鍵槓桿。

### 需要的抽取（Phase 5）
spek 的可重用 React 元件目前住在 `@spek/web` 裡、未對外輸出。建議抽出一個 **`@spek/ui`** package，內含：
- `ApiAdapter` 介面 + 共用型別
- 可重用頁面/元件：Dashboard、SpecDetail、ChangeDetail、GraphView、TabView、markdown 渲染 + BDD 高亮
- 讓 `@spek/web` 與 `@spek/workspace` 同時依賴 `@spek/ui`（此步會動到 web，需回歸測試）。

### core 需要的小幅擴充
目前通用檔案操作（`safeReadDir`、`readFileOrNull`）是 scanner.ts 的私有 helper。建議抽成 core 的公開模組，新增 `listDir` / `readFile` / `writeFile` / `stat`，供 workspace 的 fs IPC 重用。

### 不動
- VS Code Extension、IntelliJ Plugin、Demo、Web 版維持原本唯讀檢視器角色。

---

## 4. 目標 Layout

**定位原則**：OpenSpec 是主角。OpenSpec 主畫面恆常存在於主編輯區，以一個「釘住、不可關閉」的 home tab 呈現；檔案編輯與特定 spec/change 則是可開關的 tab，排在它右邊。

```
┌────┬──────────────────┬─────────────────────────────────────────────┐
│    │  EXPLORER        │ ┌─────────────────────────────────────────┐  │
│ 📁 │  ════════════    │ │ 📊 OpenSpec │ scanner.ts ● │ Spec:auth │+│  │ ← 混合 tab bar
│    │  ▾ project-a     │ ├──┴──────────┴──────────────┴───────────┴─┤  │   (📊 釘住,最左)
│ 🔍 │     ▾ src/       │ │ ┌──────┬──────────────────────────────┐ │  │
│    │        scanner.ts│ │ │Dash  │  Overview                    │ │  │
│ ⚙  │        types.ts  │ │ │Specs │  ▸ 12 specs  ▸ 5 changes     │ │  │ ← OpenSpec home
│    │     README.md    │ │ │Change│                              │ │  │   (= 現在的 spek
│    │  ▸ project-b     │ │ │Graph │  [統計卡片 / 列表 / 圖]      │ │  │    完整 app)
│    │                  │ │ └──────┴──────────────────────────────┘ │  │
│    │                  │ └─────────────────────────────────────────┘  │
│    │                  │ ┌─────────────────────────────────────────┐  │
│    │  [+ Add Folder]  │ │ TERMINAL ⟩ claude │ bash │          + ▭ ✕│  │ ← terminal dock
│    │                  │ │ ~/project-a $ claude                     │  │
│    │                  │ └─────────────────────────────────────────┘  │
├────┴──────────────────┴─────────────────────────────────────────────┤
│ ◐ main · project-a                  UTF-8 │ TypeScript │ Ln 3  spek ws│ ← 狀態列
└──────────────────────────────────────────────────────────────────────┘
  ①活動列  ②側邊面板(檔案總管)   ③主編輯區(OpenSpec+編輯器)   ④terminal dock
```

職責劃分：**左 = 檔案總管、主上 = OpenSpec + 編輯器、主下 = terminal**。四條分隔線（活動列｜面板、面板｜主區、主區｜dock、terminal 高度）皆可拖動。

### 各區操作
- **① 活動列**：📁 Explorer / 🔍 搜尋（沿用 spek `Cmd+K`）/ ⚙ 設定。因 OpenSpec 恆在主區，活動列不再需要「切到 OpenSpec」按鈕，左側面板專心當檔案總管。
- **② 側邊面板（Explorer）**：多 folder 檔案樹，可 `[+ Add Folder]` 加入（原生對話框、持久化）、右鍵移除；子目錄 lazy load；chokidar 監控外部變更自動更新。
- **③ 主編輯區（混合 tab）**：
  - `📊 OpenSpec` 為**釘住、不可關閉**的 home tab，內部就是現有 spek app（含 Dashboard/Specs/Changes/Graph 子導覽），透過 `IpcAdapter` 整套重用。
  - 檔案 tab 用 Monaco 顯示，可編輯 + syntax highlight；`●` 表未存檔，`Cmd/Ctrl+S` 存檔。
  - 特定 spec/change 可「在新 tab 開啟」釘成獨立 tab，方便邊看 spec 邊改 code。
- **④ Terminal dock**：跑 agent 主場；`+` 開新 `node-pty` session（預設 cwd = 選中的 folder），多 terminal 以 tab 切換，可 resize / 最大化 / 關閉。

### tab 行為
| 動作 | 行為 |
|------|------|
| 點 `📊 OpenSpec` home tab | 回 OpenSpec 主畫面（內部切換 Dashboard/Specs/Changes/Graph，沿用 spek 路由） |
| 在 OpenSpec 內點 spec/change | 預設在 home tab 內導覽（保留 spek 現有 UX） |
| 對 spec/change「在新 tab 開啟」 | 釘成獨立 tab，可與 code 並排 |
| 從 explorer 點檔案 | 開成可關閉的 Monaco 編輯器 tab |
| spec ↔ 檔案 交叉跳轉 | spec 頁可跳底層 `.md`；編輯器可反查所屬 change |

---

## 5. 分階段藍圖

每個 Phase 對應一個（或數個）OpenSpec change，依 CLAUDE.md 工作流 proposal → design → tasks → 實作 → verify → archive。

### Phase 0 — 基礎建設與技術驗證（spike）
**目標**：`@spek/workspace` 能開出視窗、renderer 跑起來，並驗證高風險相依可在 Electron 打包下運作。
- 建 package 骨架：electron-vite + React + Tailwind v4 + TypeScript。
- 主行程 import `@spek/core` 成功（印出某 repo 的掃描結果）。
- **技術驗證**：node-pty（`electron-rebuild`）能 spawn shell；Monaco 能在 renderer 載入並高亮。
- **風險**：node-pty native ABI、Monaco worker 打包。先驗證可大幅降後期風險。

### Phase 1 — 多 folder 工作區骨架
**目標**：可加入/移除多個 folder 並持久化，三欄 layout 成形。
- Workspace 設定（folder 清單）存 userData，重開記得。
- 活動列 + folder 清單 UI；split panes 三欄骨架。
- IPC：`fs.listDir`（重用 core）。
- 「新增 folder」用 Electron 原生對話框。

### Phase 2 — File Explorer + 唯讀檢視
**目標**：能瀏覽檔案樹、開檔檢視。
- 遞迴檔案樹（子目錄 lazy load）。
- IPC：`fs.readFile`。
- **全域 tab manager**：開檔成 tab；markdown 用 spek 渲染、其餘用 Monaco 唯讀。
- 檔案監控：chokidar（主行程）→ IPC push → renderer 更新；外部變更時提示重載。

### Phase 3 — 編輯能力
**目標**：Monaco 可編輯、存檔、syntax highlight。
- 多語言 syntax highlight、dirty 狀態、`Cmd/Ctrl+S` 存檔、關閉未存提示。
- IPC：`fs.writeFile`（限制在已加入的 workspace folders 內 → 信任/安全模型）。
- 存檔與外部變更衝突處理。

### Phase 4 — Terminal（agent 主場）
**目標**：底部可開多個 terminal，能跑 agent。
- 主行程：`node-pty` 多 session 管理；IPC 雙向串流。
- xterm.js 前端 + fit addon；底部 dock 多 tab、可 resize。
- 新 terminal 預設 cwd = 當前選中的 folder。
- 處理 session 生命週期（視窗關閉時清理子行程）。

### Phase 5 — 整合既有 spek 視圖
**目標**：OpenSpec 內容以 tab 開在主區，與檔案並存。
- 抽出 **`@spek/ui`**（見 §3），讓 web 與 workspace 共用元件（會動到 web，需回歸）。
- 實作 **`IpcAdapter`**（ApiAdapter 介面），主行程用 `@spek/core` 回應。
- 活動列「OpenSpec」入口；Dashboard / Specs / Changes / Graph 以 tab 呈現。
- 交叉導覽：從 spec/change 跳到底層檔案，反之亦然。

### Phase 6 — 打包、設定與發佈
**目標**：可安裝、體驗完整。
- electron-builder 產出三平台安裝檔。
- 沿用 spek 深色主題（#0a0c0f / amber #f59e0b）、圖示、原生選單。
- 持久化開啟的 tab / layout / 最近工作區。
- （可選）自動更新、CHANGELOG 流程。

---

## 6. 橫切關注點

- **狀態持久化**：工作區 folder、開啟 tab、panel 尺寸、最近專案。
- **快捷鍵 / 命令面板**：沿用 spek 的 `Cmd+K`，擴充為開檔 / 切 tab / 開 terminal。
- **主題**：沿用 spek dark/light，Monaco 與 xterm 主題同步。
- **安全/信任模型**：fs 寫入與 terminal cwd 限制在已加入的 workspace folders；Electron `contextIsolation: true`、停用 `nodeIntegration`，所有能力走 preload 白名單。
- **效能**：大目錄樹 lazy load；大檔案 Monaco 上限保護。

---

## 7. 主要技術風險與緩解

| 風險 | 緩解 |
|------|------|
| node-pty native ABI 對不上 Electron | Phase 0 先用 `electron-rebuild` 驗證；鎖 Electron 版本 |
| Monaco + Vite worker 設定繁瑣 | Phase 0 驗證；必要時退守 CodeMirror 6 |
| `@spek/ui` 抽取波及 web | 抽取前先確保 web 有基本回歸；小步搬移 |
| Electron 安全設定不當 | 預設 contextIsolation + preload 白名單，不開 nodeIntegration |
| 打包體積大 | 評估 Monaco 按需載入 / CodeMirror 取捨 |

---

## 8. 建議的第一步

1. 先做 **Phase 0** 的 OpenSpec change（package 骨架 + node-pty/Monaco 技術驗證），把最大風險前置清掉。
2. 確認可行後，依 Phase 1 → 6 逐步推進，每階段獨立成 change、可單獨驗收。

> 開新 change 用 `/openspec-new-change` 或 `/opsx:new`。建議首個 change 命名類似 `workspace-foundation-spike`。
