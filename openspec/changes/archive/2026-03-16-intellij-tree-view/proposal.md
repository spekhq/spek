## Why

IntelliJ plugin 目前只透過 JCEF webview（或 JCEF 不可用時開啟外部瀏覽器）來呈現 OpenSpec 內容。不像 VS Code extension 在 sidebar 提供 Specs 和 Changes 的原生 TreeView，IntelliJ 使用者缺少一個輕量的導覽方式來快速瀏覽 spec 和 change 列表。TreeView 是 IDE plugin 的基本功能，不論 JCEF 是否可用都應該提供。

## What Changes

- 在 IntelliJ Tool Window 中新增原生 TreeView，列出 Specs 和 Changes
- Specs 列表按字母排序，顯示 topic 名稱
- Changes 列表依 Active / Archived 分組，顯示 slug 名稱
- 點擊 TreeView 項目時，在 JCEF webview 中導覽至對應頁面（若 JCEF 不可用，則開啟外部瀏覽器對應路徑）
- TreeView 在 openspec/ 目錄檔案變更時自動刷新
- Tool Window 改為上方 TreeView + 下方 JCEF webview（或 fallback）的分割佈局

## Capabilities

### New Capabilities
- `intellij-tree-view`: IntelliJ plugin 原生 TreeView 導覽功能，包含 Specs 列表、Changes 分組列表、點擊導覽、自動刷新

### Modified Capabilities
- `intellij-plugin-host`: Tool Window 佈局從單一 webview 面板改為 TreeView + webview 分割佈局

## Impact

- **程式碼**：`packages/intellij/src/main/kotlin/com/spek/intellij/` 新增 tree provider 相關類別，修改 `SpekToolWindowFactory` 和 `SpekBrowserPanel` 佈局
- **依賴**：使用 IntelliJ Platform SDK 內建的 Tree API，無需新增外部依賴
- **現有功能**：JCEF webview 和外部瀏覽器 fallback 機制不受影響，僅佈局方式調整
