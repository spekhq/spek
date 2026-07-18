## 1. Tree Data Model

- [x] 1.1 建立 `SpekTreeNode` sealed class 定義節點類型（Root / SpecItem / ChangeGroup / ChangeItem）
- [x] 1.2 建立 `SpekTreeModel` 類別，使用 `OpenSpecScanner.scan()` 產生 `DefaultTreeModel`，包含 Specs 和 Changes 兩個根節點

## 2. Tree Cell Renderer

- [x] 2.1 建立 `SpekTreeCellRenderer` 自訂 renderer，根據節點類型顯示對應 icon 和文字（Specs 用資料夾 icon、ChangeGroup 用分支/封存 icon、items 用文件 icon）

## 3. Tree Panel

- [x] 3.1 建立 `SpekTreePanel` 元件，內含 `Tree` 和 `SpekTreeModel`，提供 `refresh()` 方法重建 tree model
- [x] 3.2 實作 double-click listener，根據節點類型觸發對應的導覽動作

## 4. Tool Window 佈局重構

- [x] 4.1 修改 `SpekToolWindowFactory`，將 Tool Window content 從單一 `SpekBrowserPanel` 改為 `JSplitPane`（上方 TreePanel + 下方 BrowserPanel）
- [x] 4.2 調整 `SpekBrowserPanel` 暴露導覽介面，讓 TreePanel 可呼叫 JCEF `executeJavaScript()` 或 `BrowserUtil.browse()` 進行導覽

## 5. 導覽機制

- [x] 5.1 在 `SpekBrowserPanel` 新增 `navigateTo(path: String)` 方法，JCEF 模式下用 `executeJavaScript` 發送 `spek:navigate` custom event，fallback 模式下開啟外部瀏覽器
- [x] 5.2 實作 webview ready state 追蹤，在 webview 未就緒時將導覽請求排入佇列，就緒後自動執行
- [x] 5.3 前端 React app 新增 `spek:navigate` event listener，接收路徑並透過 React Router 導覽

## 6. Tree 自動刷新

- [x] 6.1 擴展現有的 file watcher 機制，在 openspec/ 檔案變更時同時呼叫 `SpekTreePanel.refresh()`，共用現有的 500ms debounce
