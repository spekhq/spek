## Context

IntelliJ plugin 目前的 Tool Window 只包含一個 JCEF webview（或 JCEF 不可用時的外部瀏覽器 fallback）。VS Code extension 已有原生 TreeView 在 sidebar 顯示 Specs 和 Changes 列表，但 IntelliJ 端缺少這個導覽機制。

現有 Kotlin core（`OpenSpecScanner`）已實作 `scan()` 方法，可取得 specs、activeChanges、archivedChanges，可直接複用。

## Goals / Non-Goals

**Goals:**
- 在 Tool Window 中新增原生 Tree 元件，列出 Specs 和 Changes
- 點擊 Tree 節點可導覽 JCEF webview 或開啟外部瀏覽器
- openspec/ 檔案變更時自動刷新 Tree
- 不論 JCEF 是否可用，Tree 都正常運作

**Non-Goals:**
- 不實作 Tree 中的 spec 內容預覽或內嵌 markdown 渲染
- 不替換現有 JCEF webview，Tree 是補充導覽而非替代方案
- 不實作 Tree 中的搜尋功能（搜尋仍在 webview 中）

## Decisions

### 1. 佈局：JSplitPane 垂直分割

Tool Window 改用 `JSplitPane` 垂直分割：上方為 Tree 面板，下方為 JCEF webview（或 fallback）。

**替代方案**：Tab 分頁（Tree tab + Webview tab）— 不採用，因為 Tree 和 webview 應同時可見，Tree 作為持續性的導覽面板。

**替代方案**：Content Manager 多 tab — 不採用，同理需要同時可見。

### 2. Tree 結構：兩個根節點

```
Specs
├── api-adapter
├── core-module
└── ...
Changes
├── Active
│   ├── 2026-03-16-intellij-tree-view
│   └── ...
└── Archived
    ├── 2026-03-01-some-feature
    └── ...
```

- **Specs** 根節點：扁平列表，按字母排序
- **Changes** 根節點：Active / Archived 兩個分組，每組內依日期倒序

這與 VS Code 的 TreeView 結構一致。

### 3. 導覽機制：JCEF executeJavaScript + URL hash fallback

點擊 Tree 節點時：
- JCEF 可用：呼叫 `cefBrowser.executeJavaScript()` 觸發 `window.dispatchEvent(new CustomEvent('spek:navigate', { detail: { path } }))` 前端監聽此事件進行路由導覽
- JCEF 不可用：使用 `BrowserUtil.browse()` 開啟外部瀏覽器，URL 以 hash fragment 帶入目標路徑（如 `#/changes/some-slug`），前端 `IntellijApp` 在初始化時讀取 `window.location.hash` 作為 `MemoryRouter` 的 `initialEntries`

### 4. 刷新機制：複用現有 file watcher

`SpekBrowserPanel` 已有 `WatchService` 監控 openspec/ 目錄。擴展它在檔案變更時同時通知 Tree model 刷新。使用現有的 500ms debounce 機制。

### 5. Tree API：使用 `com.intellij.ui.treeStructure.Tree` + `DefaultTreeModel`

使用 IntelliJ SDK 的 `Tree` 元件搭配 `DefaultMutableTreeNode` 和自訂 `TreeCellRenderer`。

**替代方案**：`AbstractTreeStructure` + `AsyncTreeModel` — 較新但較複雜，本案資料量小且同步載入即可，不需要非同步 tree model。

## Risks / Trade-offs

- **[Tree 佔用空間]** → 使用 `JSplitPane` 的 divider 讓使用者自由調整 Tree / webview 的比例，且記住上次的分割位置
- **[掃描效能]** → `OpenSpecScanner.scan()` 是檔案系統操作，在大型專案中可能略慢 → 在背景執行緒掃描，避免阻塞 UI thread
- **[JCEF 導覽時機]** → webview 可能尚未載入完成時使用者點擊 Tree → 加入 ready state 檢查，在 webview 就緒前將導覽請求排入佇列
