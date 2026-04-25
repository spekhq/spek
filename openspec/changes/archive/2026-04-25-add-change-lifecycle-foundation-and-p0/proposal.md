## Why

OpenSpec 工作流產出的每個 change 都會在 `.openspec.yaml` frontmatter 寫入 `created: YYYY-MM-DD`，但 spek 目前完全沒讀。現況用 git first-commit timestamp + folder name 解析的日期當顯示時間，會被 rebase / squash / shallow clone 抹掉，且非 git repo 拿不到；同時缺少「change 從建立到歸檔花了多久」這種**生命週期**視角，使用者看不到 active change 已經拖了多久、archived change 從提案到收尾花了幾天。

Phase 1 把 `created` 讀進來，搭配從 archive folder name 推導出的 `archivedDate`，在 ChangeList、ChangeDetail、Dashboard、VS Code sidebar 四個高頻入口呈現生命週期資訊，一次完整 ship。完整 roadmap 見 `docs/change-lifecycle-roadmap.md`。

## What Changes

- **Foundation（@spek/core）**：scanner 讀 `.openspec.yaml` 的 `created` 欄位，並從 archive folder name prefix（`YYYY-MM-DD-slug`）推導 `archivedDate`；`ChangeInfo` / `ChangeDetail` 新增 `createdDate` 與 `archivedDate` 兩個欄位（皆 nullable）
- **ChangeList row 生命週期顯示**：active change 顯示 `Created Apr 20 · 5d ago`、archived 顯示 `Created Feb 14 → Archived Feb 22 · 8d`；既有 git timestamp 顯示降為次要（tooltip 內）
- **ChangeDetail header lifecycle banner**：標題下方加生命週期橫條，archived 顯示 `Created 2026-02-14 · Archived 2026-02-22 (8 days)`，active 顯示 `Created 2026-04-20 · Active for 5 days`
- **Dashboard 新統計卡片**：加 `Avg lifecycle (archived)` 與 `Stale active (>30d)` 兩張卡
- **VS Code sidebar 生命週期 hint**：active change TreeItem description 顯示 `(Nd)`，tooltip 加 `Created: YYYY-MM-DD`；archived 顯示 `→ archived (Nd)`
- **排序維持原本 git timestamp 順序**（避免列表順序突變）

不在這次範圍：IntelliJ scanner / sidebar 同步、ChangeList sort dropdown、Stale clickable list、Timeline 新頁面、SpecDetail 對齊 change 時間（皆排在後續 Phase）。

## Capabilities

### New Capabilities

無。本次全部修改既有 capability。

### Modified Capabilities

- `openspec-scanner`：`ChangeInfo` 新增 `createdDate` / `archivedDate` 欄位；scanner SHALL 讀 `.openspec.yaml` 的 `created` 欄位、SHALL 對 archive change 從 folder name prefix 推導 `archivedDate`
- `change-browsing`：ChangeList row SHALL 顯示生命週期文字（active 與 archived 格式不同）；ChangeDetail header SHALL 在標題下方顯示 lifecycle banner
- `dashboard-view`：Dashboard SHALL 顯示「Avg lifecycle (archived)」與「Stale active (>30d)」兩張統計卡片
- `vscode-sidebar`：active / archived change TreeItem 的 `description` SHALL 顯示生命週期天數簡寫；tooltip SHALL 包含 `Created` 日期

## Impact

- **Code**：
  - `packages/core/src/scanner.ts`、`packages/core/src/types.ts`（資料層）
  - `packages/web/src/pages/ChangeList.tsx`、`ChangeDetail.tsx`、`Dashboard.tsx`（前端三頁）
  - `packages/vscode/src/tree-provider.ts`（VS Code sidebar）
  - 共用日期格式化 helper（新建，前端用，例如 `packages/web/src/utils/lifecycle.ts`）
- **API**：`/api/openspec/changes`、`/api/openspec/changes/:slug` 回傳 payload 多兩個欄位（向後相容，舊 client 忽略即可）
- **Dependencies**：無新依賴。沿用既有 yaml regex parser 風格擴充
- **Demo**：`docs/demo.html` 重 build 後會自動帶入新欄位，無額外處理
- **不影響**：IntelliJ Kotlin scanner（拆獨立 change 處理）、core git-cache 邏輯（`timestamp` 欄位保留不動）、現有排序行為
