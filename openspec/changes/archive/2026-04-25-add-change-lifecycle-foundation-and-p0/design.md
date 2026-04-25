## Context

OpenSpec 工作流為每個 change 在 `.openspec.yaml` 寫入 `created: YYYY-MM-DD`，但 spek 目前沒讀。現況時間顯示靠 git first-commit timestamp（`@spek/core` 的 `git-cache.ts`）+ folder name 解析的 `date`，會被 rebase / squash / shallow clone 抹掉，且非 git repo 拿不到。

Phase 1 把 `created` 讀進來、搭配 archive folder name prefix 推導的 `archivedDate`，在 ChangeList、ChangeDetail、Dashboard、VS Code sidebar 四個高頻入口呈現生命週期。完整 roadmap 見 `docs/change-lifecycle-roadmap.md`。

## Goals / Non-Goals

**Goals:**
- 讓 `created`（人類意圖）成為主要時間來源，git timestamp 降為次要顯示
- ChangeList、ChangeDetail、Dashboard、VS Code sidebar 一次完整 ship 生命週期體驗
- 維持向後相容：API 新增欄位但既有欄位不改、舊 client 忽略新欄位即可
- 維持現有列表排序（git timestamp）不變，避免 UX 突變

**Non-Goals:**
- IntelliJ Kotlin scanner 同步（拆 Phase 4 獨立 change）
- ChangeList sort dropdown / Stale clickable list（Phase 2）
- 新 `/timeline` 頁面（Phase 3）
- SpecDetail 對齊 change 時間（Phase 5）
- 引入正式 yaml lib（沿用現有 regex 風格）
- 改 git-cache 邏輯（`timestamp` 欄位保留）

## Decisions

### D1: 沿用 regex yaml parser，不引 `js-yaml`
現有 scanner 用 regex 抓 `^key:\s*(.+)$` 形式的頂層欄位，補抓 `created` 在能力內。引入 `js-yaml`（+ Kotlin 端 `snakeyaml`）會讓三端各加一份 runtime 依賴，且 demo build 也要重新評估 bundle size。等 schema 真的長到 nested（例如 `lifecycle: { created, archived, milestones }`）再切。

**Alternative**: 用 `js-yaml`。否決：ROI 不對等。

### D2: `createdDate` / `archivedDate` 用 `string | null`，不轉 ISO Date
- 來源就是 `YYYY-MM-DD` 字串（yaml frontmatter / folder name prefix）
- React 端用字串比對 / 顯示更直覺，序列化也省事
- 跨時區無歧義（這是「日期」不是「時刻」）
- 既有 `date` 欄位也是字串，型別一致

### D3: 不在後端算 `lifecycleDays`
Active change 的「Active for Nd」要根據「今天」即時算，後端固定值會 stale（隔夜變舊）。Archived 雖可固定，但前後端兩邊算不同邏輯反而散，統一**前端**算。

提供 `packages/web/src/utils/lifecycle.ts` helper：
- `daysBetween(a: string, b: string): number`
- `formatLifecycleListRow(info: ChangeInfo, today: string): string` — list row 顯示文字
- `formatLifecycleBanner(info: ChangeDetail, today: string): string` — detail banner 顯示文字
- `formatShortDate(iso: string): string` — `"2026-04-20"` → `"Apr 20"`

VS Code sidebar 需獨立輕量版（在 `packages/vscode/src/lifecycle.ts`），因為 extension host 不能 import web 的東西。

### D4: `archivedDate` 唯一來源為 archive folder name prefix
yaml 沒有 `archived` 欄位（不要為了這個改 OpenSpec 工作流）。`parseSlug()` 對 archive folder 強制 `YYYY-MM-DD-slug` 格式是現有 invariant，可信賴。Active change 的 `archivedDate` 永遠是 `null`。

### D5: 排序維持原本 git timestamp 順序
若改用 `createdDate` 排序，使用者打開列表時順序會突變（rebase 過或新檔的順序差異會被放大）。**排序行為這次不動**，僅顯示文字改變。後續 Phase 2 加 sort dropdown 才開放選排序鍵。

### D6: `created` vs git timestamp 衝突時相信 yaml
`createdDate` 是人寫的意圖，git timestamp 是 commit 時間（可能晚於建立）。差距合理，不需 UI 警示，**git timestamp 降為 tooltip 內次要顯示**即可。

### D7: List row fallback 鏈
1. 有 `createdDate` → 顯示 lifecycle（active 或 archived 格式）
2. 無 `createdDate` 但有 git `timestamp` → 退回顯示「N days ago」（現有行為）
3. 兩者皆無 → 退回顯示 slug `YYYY-MM-DD`（現有行為）

不會出現 `createdDate` 缺漏的正常情況（OpenSpec 預設都有寫），但 fallback 保留以防使用者手寫 yaml 漏填或讀其他人的舊 repo。

### D8: ChangeDetail banner 在 `createdDate` 為 `null` 時不顯示
寧可不顯示也不要顯示假資料。`createdDate` 為 `null` 是 edge case，使用者看標題下方沒 banner 不會困惑。

## Risks / Trade-offs

- **[Risk] `.openspec.yaml` 的 `created` 格式不是 `YYYY-MM-DD`** → Mitigation: regex 嚴格匹配 `^created:\s*(\d{4}-\d{2}-\d{2})\s*$`，不符合就視為 null（fallback 到既有 git timestamp 顯示）
- **[Risk] Demo build 內嵌資料未含新欄位** → Mitigation: `scripts/build-demo.ts` 走的是同一個 `scanOpenSpec()`，自動帶；驗證時打開 `docs/demo.html` 確認
- **[Risk] React 跨日 stale**：「Active for Nd」基於 `today`，跨午夜不會自動刷新 → Mitigation: 接受。重新整理就更新，不值得加 timer
- **[Trade-off] 顯示文字混入英文「ago / days / Created / Archived」**：spek 既有 UI 文字本就英文（`Active`, `Archived`, `No content` 等），維持一致
- **[Risk] VS Code TreeItem `description` 過長導致截斷** → Mitigation: 用 `(5d)` / `→ archived (8d)` 短格式，完整資訊放 tooltip

## Migration Plan

無資料遷移需求。新欄位皆為 nullable，舊 archive change 沒填 `created` 也能正常運作（fallback 到既有顯示）。
