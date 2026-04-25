# Change 生命週期視覺化 Roadmap

> 產出日期：2026-04-25
> 議題：活用 `.openspec.yaml` 的 `created` 欄位
> 狀態：Phase 1（Foundation + P0）將以一個 OpenSpec change 進行

---

## Context

OpenSpec 工作流產出的每個 change 都會在 `.openspec.yaml` frontmatter 寫入 `created: YYYY-MM-DD`，但 spek 目前完全沒讀這個欄位。現況用 git first-commit timestamp（`@spek/core` 的 `git-cache.ts`）+ folder name prefix 解析出的 `date` 當顯示時間，缺點：

- git timestamp 會被 rebase / squash / shallow clone 抹掉，且非 git repo（demo / 直接下載 zip）拿不到
- folder name 的日期前綴對 active change 不強制，且對 archive change 是「歸檔日」而非「建立日」，語意混淆
- 缺少「change 從建立到歸檔花了多久」這種**生命週期**視角

這份文件盤點 `created`（+ 從 archive folder name `YYYY-MM-DD-slug` 推導出的 archived date）能在 spek 各介面開出哪些功能，分級後給出可獨立 ship 的實作順序。**這是機會選單**，挑要實作哪幾個。

---

## A. Foundation（資料層，所有功能的前提）

不寫死「全部一起 ship」，但要先把欄位流出來，後續 UI 才能用。

### `@spek/core` types
`ChangeInfo` / `ChangeDetail` 加：
- `createdDate: string | null` — 來自 yaml `created`
- `archivedDate: string | null` — 僅 archive，從 folder name prefix `YYYY-MM-DD-slug` 解析（`parseSlug()` 已能解析）

> 不加 `lifecycleDays`：前端算更靈活（active change 的「N days ago」要即時刷新，後端固定值會 stale）。

### `@spek/core` scanner
- 既有的內聯 yaml regex 抽成 `parseChangeYaml(content)`，補抓 `^created:\s*(\d{4}-\d{2}-\d{2})$`
- `scanChanges()` 走訪 archive 時把 `parseSlug().date` 填到 `archivedDate`；走訪 active 時 `archivedDate = null`
- 保留現有 `date` / `timestamp` 欄位不動（向後相容、排序不破）

### Web server / VS Code handler
- `/api/openspec/changes` 直接吐 `scanOpenSpec()` 結果，type 自動帶，**無 server 端改動**
- VS Code handler 直接 import `@spek/core`，**自動同步**

### IntelliJ scanner（Kotlin）
- `scanChangeDir()` 補 yaml 讀取（Kotlin regex，跟 TS 對齊）
- `ChangeInfo` data class 加同名欄位
- **可獨立 PR、可延後**（只影響 IntelliJ，測試門檻較高）

---

## B. 功能分級清單

### P0 — Must（高 ROI、改動小、最直接的價值）

| # | 位置 | 提案 | 複雜度 |
|---|---|---|---|
| 1 | `ChangeList.tsx` row | 每 row 顯示 `Created Apr 20 · 5d ago`（active）或 `Created Feb 14 → Archived Feb 22 · 8d`（archived） | S |
| 2 | `ChangeDetail.tsx` header | Lifecycle banner：`Created 2026-02-14 · Archived 2026-02-22 (8 days)`，active 顯示 `Active for 12 days` | S |
| 3 | `Dashboard.tsx` 統計卡片 | 加 `Avg lifecycle (archived)` + `Stale active (>30d)` 兩張卡 | S |
| 4 | VS Code sidebar | TreeItem `description` 顯示 `(12d)`，tooltip 加 `Created: 2026-02-14` | S |

### P1 — Nice-to-have（增量價值，獨立 ship）

| # | 位置 | 提案 | 複雜度 |
|---|---|---|---|
| 5 | Dashboard 新區塊 | 「Stale active changes」清單（>30d 未 archive，行動導向） | S |
| 6 | `ChangeList.tsx` 排序 | sort dropdown：created / lifecycle / status | S |
| 7 | 新頁面 `/timeline` | 全部 changes 的水平 Gantt 風時間軸（active 實線、archived 區段、按 spec topic 分群可選） | M |
| 8 | `SpecDetail.tsx` history 區塊 | 把 spec 歷次變更的時間點對齊到對應 change 的 created/archived，視覺串連 | M |
| 9 | IntelliJ sidebar 同步 P0 #4 | Kotlin renderer 補 description / tooltip | S |

### P2 — Experimental（ROI 不確定，先擱）

| # | 位置 | 提案 | 為何 P2 |
|---|---|---|---|
| 10 | `GraphView.tsx` 節點時間編碼 | 節點色階反映年齡，archive 虛線邊框 | force graph 已複雜，疊維度容易亂 |
| 11 | Dashboard heatmap | GitHub 風格 created/archived 日曆熱圖 | 漂亮但低行動性 |
| 12 | `SearchDialog.tsx` filter | `created:>2026-01-01`、`stale:true` 語法 | 進階使用者才用 |
| 13 | Velocity 報表頁 | 月 throughput、p50/p95 lifecycle | 小專案樣本太少 |

---

## C. 推薦實作順序（每步可獨立 ship）

每個編號 = 一個 OpenSpec change。

1. **Phase 1**：Foundation A + P0 #1~#4（一次 ship 完整生命週期體驗，含 web + vscode）
2. **Phase 2**：P1 #5 + #6（Stale clickable list + ChangeList sort，共用 Phase 1 資料）
3. **Phase 3**：P1 #7 `/timeline` 新頁面（最大視覺亮點，獨立完成）
4. **Phase 4**：P1 #9 IntelliJ scanner + sidebar 同步
5. **Phase 5**：P1 #8 SpecDetail 對齊 change 時間
6. P2 視回饋

---

## D. 關鍵取捨與風險

- **YAML parser 不引 lib**：現有 regex 只認頂層 `key: value`，補 `created` 在能力內。引 `js-yaml` + Kotlin `snakeyaml` 三端各加一份依賴，ROI 不對等。等 schema 變 nested 再切。
- **Archive date 推導順序**：folder name prefix 為唯一來源（yaml 沒寫 `archived`）。`parseSlug` 對 archive 強制 prefix 是現有 invariant，可信賴；但 scanner 仍應 null-safe（理論上不可能，但別 crash）。
- **`created` vs git timestamp 衝突**：相信 yaml `created`（人類意圖），原 `timestamp` 降級為次要顯示（tooltip 或不顯示）。**排序維持原本 timestamp 順序**，避免列表突然重排破壞使用者預期。
- **IntelliJ 同步成本中等但測試門檻高**：拆獨立 change（Phase 4），不阻塞 web 迭代。
- **Active change 沒有 archivedDate 的 UI 處理**：active 顯示 `Active for Nd`（即時計算 today − created），archived 顯示固定 `Created → Archived (Nd)`。
