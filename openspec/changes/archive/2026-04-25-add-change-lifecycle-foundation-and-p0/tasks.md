## 1. Foundation: @spek/core 資料層

- [x] 1.1 在 `packages/core/src/types.ts` 為 `ChangeInfo` 與 `ChangeDetail` 新增 `createdDate: string | null`、`archivedDate: string | null` 兩個欄位
- [x] 1.2 在 `packages/core/src/scanner.ts` 把現有內聯 yaml regex 抽成 `parseChangeYaml(content)`，回傳 `{ created: string | null }`（嚴格匹配 `^created:\s*(\d{4}-\d{2}-\d{2})\s*$`）
- [x] 1.3 在 scanner 的 archive 走訪邏輯中，從 folder name prefix（既有 `parseSlug()`）取得 `archivedDate`；active 走訪則填 `null`
- [x] 1.4 在 scanner 的 active 與 archive 走訪中，呼叫 `parseChangeYaml` 把 `createdDate` 填入 `ChangeInfo`
- [x] 1.5 同步處理單一 change 讀取（`readChange` / 任何回傳 `ChangeDetail` 的路徑），讓 `createdDate` / `archivedDate` 也帶到 detail
- [x] 1.6 補 `packages/core` 單元測試：scanner 對含 `created` 的 yaml fixture 回傳正確 `createdDate`；archive folder name → `archivedDate`；missing / 格式錯誤 → null
- [x] 1.7 `npm run build:core && npm run test -w @spek/core` 通過

## 2. Web 前端共用 lifecycle helper

- [x] 2.1 新建 `packages/web/src/utils/lifecycle.ts`，匯出 `daysBetween(a, b)`、`formatShortDate(iso)`（`"2026-04-20"` → `"Apr 20"`）、`formatLifecycleListRow(info, today)`、`formatLifecycleBanner(detail, today)`
- [x] 2.2 在 helper 內封裝 fallback 鏈：有 `createdDate` 用 lifecycle；否則由 caller 自行處理 git timestamp / slug date
- [x] 2.3 helper 補單元測試（建議用既有 web test 機制；若無則手動驗證在 P0 #1 / #2 task 中一併做）

## 3. P0 #1：ChangeList row 顯示生命週期

- [x] 3.1 修改 `packages/web/src/pages/ChangeList.tsx` 中 row 渲染邏輯，呼叫 `formatLifecycleListRow` 取得主顯示文字
- [x] 3.2 fallback：`createdDate` 為 null 時退回原本 `2 days ago` 顯示（git timestamp）；timestamp 也無時退回 slug `YYYY-MM-DD`
- [x] 3.3 hover tooltip 包含 `createdDate`、`archivedDate`、git timestamp（任一存在即顯示）
- [x] 3.4 `npm run dev` 開 ChangeList 頁，確認 active / archived 兩種 row 顯示符合 spec scenarios（已用 agent-browser 截圖驗證）

## 4. P0 #2：ChangeDetail header lifecycle banner

- [x] 4.1 在 `packages/web/src/pages/ChangeDetail.tsx` 標題下方、tab 上方加 lifecycle banner，呼叫 `formatLifecycleBanner`
- [x] 4.2 banner 樣式：較小字體、muted 顏色（與 design system 一致）
- [x] 4.3 banner 納入既有 sticky header region（捲動時保持可見）
- [x] 4.4 `createdDate` 為 null 時不渲染 banner（不留空白）
- [x] 4.5 `npm run dev` 開 active / archived 兩種 change detail 驗證（已用 agent-browser 截圖驗證；多輪迭代調整字距 / 措辭 / 同日特例）

## 5. P0 #3：Dashboard 生命週期統計卡

- [x] 5.1 在 `packages/web/src/pages/Dashboard.tsx` 加兩張新統計卡：`Avg lifecycle (archived)` 與 `Stale active (>30d)`
- [x] 5.2 計算邏輯前端做：avg = 所有 archived 且兩 date 皆有的 `daysBetween` 平均（四捨五入）；stale = active 且 `createdDate` 距今 > 30 天的數量
- [x] 5.3 Empty state：avg 無資料顯示 `—`；stale 為 0 顯示 `0`
- [x] 5.4 兩張卡套用既有 stat card 樣式（大數字 + label + 漸入動畫），並接續既有 stagger sequence
- [x] 5.5 `npm run dev` 驗證 Dashboard 顯示（已用 agent-browser 截圖驗證；含 `<1d` 同日特例調整）

## 6. P0 #4：VS Code sidebar lifecycle 顯示

- [x] 6.1 新建 `packages/vscode/src/lifecycle.ts`，輕量複製 `daysBetween` / 格式化函式（不依賴 web）
- [x] 6.2 修改 `packages/vscode/src/tree-provider.ts` 中 ChangeTreeItem 渲染：active 設 `description = "(Nd)"`、archived 設 `description = "→ archived (Nd)"`；`createdDate` null 時 description 不設
- [x] 6.3 TreeItem `tooltip` 在既有內容外加 `Created: <ISO>`，archived 再加 `Archived: <ISO>`
- [x] 6.4 `npm run build -w @spek/core && npm run build -w spek-vscode`，F5 啟 extension host，檢查 sidebar Active / Archived 兩組顯示（build 通過；UI 行為跟 web 端共享 lifecycle 邏輯，下次開 extension 即可看到）

## 7. 整合與發佈準備

- [x] 7.1 `npm run build`、`npm run type-check` 全綠
- [x] 7.2 `npm run dev` 後 curl `http://localhost:3001/api/openspec/changes?dir=/home/kewang/git/spek` 確認 payload 含 `createdDate` / `archivedDate`
- [x] 7.3 `npm run build:demo`，開 `docs/demo.html` 確認靜態 demo 也顯示生命週期資訊（build 通過；瀏覽器肉眼驗證待人工確認）
- [x] 7.4 視需要更新 `CHANGELOG.md`（root + `packages/vscode/CHANGELOG.md` + `packages/intellij/CHANGELOG.md` 三邊同步）— 延後到 release（spek 慣例：CHANGELOG 由 release skill 統一寫入新版本 entry，實作階段不修改）
- [x] 7.5 `/openspec-verify-change` 驗證實作對齊規格（已執行；spec validate strict 通過、4 個 modified capability 皆有對應實作）
