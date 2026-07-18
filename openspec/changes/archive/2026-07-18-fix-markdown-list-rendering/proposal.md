## Why

`MarkdownRenderer` 把 `ul`/`ol` 寫死成 `list-inside`（`MarkdownRenderer.tsx:230`、`:233`）。`list-style-position: inside` 會把 `::marker` 放進 list item 的**內容流**裡；而 remark 對 **loose list**（項目間有空行）會把每個項目的內容包進 `<p>`，`p` override（`:122`）又是帶 `mb-4` 的 block box。block box 無法與 inline 的 marker 共用同一個 line box，於是**marker 獨佔一行、內容掉到下一行**，還多出 1rem 的空隙：

```
•
☐ Cross-check brief values.
```

同時 `ul`/`li` 的 override 只解構 `{ children }`，**丟掉了 `className`** —— remark-gfm 產出的 `contains-task-list` / `task-list-item` 這兩個 GitHub 慣例 hook 因此從未進入 DOM，也沒有任何 CSS 設 `list-style: none`。結果 checkbox 旁邊還會**多一顆多餘的 disc**（`• ☐ PASS`）。

這在 spek 自身看不出來：spek 的 `tasks` artifact 根本不走 markdown，而是由 `ChangeDetail.tsx:46-78` 以 flex + 自繪 SVG 渲染 `parseTasks` 的結果。但**使用自訂 schema 的 repo 會直接踩到**——回報來源 `janitarr`（schema `superpowers-bridge`）把 checkbox 放進 `plan.md` / `verify.md` / `retrospective.md`，這些都是 `kind: markdown`，全部經過 `MarkdownRenderer`。其 `retrospective.md` §6 是最糟情境：loose list、每個項目內還嵌一段 blockquote。

**兩個缺陷彼此獨立**，且第一個與 checkbox 無關——任何 loose list（純文字項目符號也一樣）都會斷行，只是 checkbox 讓它更顯眼。

## What Changes

- `ul`/`ol` 由 `list-inside` 改為 **`list-outside` + 左內距**：marker 回到內容盒外，loose list 不再斷行。此為全域修正，**所有 list 的項目符號縮排會位移**（已與提案者確認接受）。
- `ul`/`li` override **向下傳遞 `className`**，讓 `contains-task-list` / `task-list-item` 真正抵達 DOM。
- **task list item 取消 marker**（`list-style: none`）並讓 checkbox 與項目**首行文字對齊**（flex align-start 或等效），wrapped 續行與內嵌 blockquote 維持可讀。
- 收斂 list item 內 `<p>` 的 `mb-4`，讓單一項目讀起來是一塊，而非數段。
- **非目標**：janitarr 使用的非 GFM `[~]` deferred 狀態。GFM 不將其解析為 task item，會原樣輸出字面文字 `[~]`；要支援需自訂 remark plugin，屬另一個 change。
- 純呈現層修正，**無 API、無 core、無 adapter 變更**。

## Capabilities

### New Capabilities
<!-- 無新增 capability -->

### Modified Capabilities
- `markdown-renderer`: 為既有的「GFM checkbox rendering」與「Markdown content rendering」補上兩條可觀測的呈現保證——(1) list marker 與項目內容**必須同行**，不因 loose/tight 而異；(2) task list item **只顯示 checkbox、不顯示 marker**，一般 list 仍保留 marker。兩者皆為使用者可見的行為契約，非實作細節。

## Impact

- **Code**: `packages/web/src/components/MarkdownRenderer.tsx`（`ul` / `ol` / `li` / `p` override）。視作法可能新增 `.markdown-body` 相關規則至 `packages/web/src/styles/global.css`——注意 `markdown-body` 這個 wrapper class 目前**全 repo 無任何 CSS 掛載**。
- **Hosts**: 前端共用，無 host 專屬程式碼，但**抵達各 host 的方式不同**：
  - **Web** 由原始碼直接建置；**IntelliJ** 的 webview 產出是 gitignore 的（`packages/intellij/.gitignore:6`），打包時重建，故兩者自動跟上。
  - **VS Code**（`packages/vscode/webview/assets/index.webview.js`）與 **demo**（`docs/demo.html`）是**已納入版控的建置產出**，兩者現在都是舊的（前者仍含 `list-disc list-inside`），**都要 rebuild + commit 才會反映**。依貢獻慣例，這兩份 bundle 留給整合階段重建，不在本 change 內。
- **視覺影響**：全 app 的 list 縮排位移（specs、proposals、change detail 等所有 markdown 內容）。這是本 change 唯一的非局部後果。
- **API / core / adapters**: 無變更。
- **Versioning**: 本 change 不 bump 版本、不寫 CHANGELOG（依貢獻慣例，留給整合階段）。
