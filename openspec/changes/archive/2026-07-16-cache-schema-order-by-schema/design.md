## Context

`readChange`（`scanner.ts`）在讀取單一 active change detail 時，呼叫 `SchemaOrderProvider` 取得 schema 權威順序（`schemaOrder`）。預設 provider（`cliSchemaOrderProvider` / Kotlin `SchemaOrder.cli`）spawn `openspec status --change <slug> --json`，這是一次 Node 行程啟動，實測 ~1.25 秒，佔整個 request 的 99.96%（純檔案 I/O 僅 ~0.5ms）。

CLI 回傳兩塊資料組成權威順序：`actionContext.planningArtifacts`（順序）與 `artifactPaths[id].outputPath`（路徑）。這兩者**只由 change 的 schema 決定**——同一 repo 內每個 `spec-driven` change 得到的 refs 完全相同。但現行 cache 以 change slug 為 key（`schema-order.ts:103`、`SchemaOrder.kt:108`），於是：

- 開 change A → 1.25s；開 change B（不同 slug）→ 又 1.25s（cache miss）；30s TTL 過後重開 A → 又 1.25s。
- 71 個 change 的 repo 最壞情況 spawn 71 次，問的是同一個問題。

`resolveSchemaOrder(refs, knownIds)` 是 change 專屬的（把 schema 的 refs 對應到該 change 已探索的 artifact ids），但它是純函式、成本趨近 0，且在 provider **之外**於 `scanner.ts` 呼叫——因此 provider 快取的 `refs` 本身確實是 per-schema 的。

## Goals / Non-Goals

**Goals:**
- 讓權威順序在快取窗（現有 30s TTL）內對每個 distinct schema 至多 spawn CLI 一次，而非每個 change 一次。
- 修正 TS 與 Kotlin 兩份 core，保持既有 API / UI / adapter / `schemaOrder` 合約完全不變（相同輸入產生相同輸出）。
- 維持既有容錯與安全邊界：CLI 缺席 / 逾時 / 非 0 → null；Kotlin 的 slug 白名單注入防護不動。

**Non-Goals:**
- 不做真正的 lazy 化（只在使用者選 Schema order 時才取）——那需跨三個前端新增端點/adapter 方法，成本大得多，留待本 change 量測後再議（issue #15 的「Possible follow-on」）。
- 不改 TTL、size cap、spawn 機制、逾時值、`parseOrderFromStatus` / `resolveSchemaOrder` 邏輯。
- 不改任何前端排序控制或顯示。

## Decisions

### D1：cache key 改以 schema 為單位，schema 未知時退回 slug

新 key：`schema` 已知 → `${repoRoot}::${schema}`；`schema` 為 `null`/空 → `${repoRoot}::${slug}`（維持現狀）。

- key 仍含 `repoRoot`：CLI 以 `cwd: repoRoot` 執行，權威順序是「該 repoRoot 下該 schema」的屬性，故 `(repoRoot, schema)` 是它的完整識別。不同 worktree/repo 以不同 `repoRoot` 天然隔離，與現行 `(repoRoot, slug)` 的 repo 範圍界定一致。
**Refinement during implementation（最終採用）：** 原先規劃 schema 為 null 時「退回以 slug 分桶」以保留舊
per-change 快取。實作時發現這其實無必要且更糟：change **無 schema 就沒有權威順序可言**，根本不該查 CLI。
故最終改為在呼叫端（`readChange` / `ChangeReader`）以 `status==="active" && schema` 提前守衛——無 schema →
直接回 null、不進 provider；provider 的 `schema` 參數因此收斂為**非空字串**，cache key 就是純粹的
`${repoRoot}::${schema}`，不需 slug、不需 null 分支。副帶修掉一個此重鍵才會有的 bug：空 slug（`readChange(repo, "")`
會指向 changes/ 目錄本身）配上 repo 預設 schema，會把 null 寫進該 schema 的桶而污染真實 change——同樣由「空 slug 提前回 null」擋掉。

**Alternatives considered:**
- *退回 slug 分桶（原規劃）*：徒增一個 null 分支與「slug 既是 CLI 目標又是 fallback key」的雙重語意；無 schema 本就無序，保留舊快取無實益。否決，改為提前回 null。
- *共用一個 null 桶*：兩個無 schema 的 change 會互相污染。否決（提前回 null 後此問題不存在）。

### D2：把 schema 傳入 provider（簽章新增第三參數）

`SchemaOrderProvider` 由 `(repoRoot, slug)` 改為 `(repoRoot, slug, schema)`：

- `slug` 仍必要——CLI 需要*某個*存在的 change 才能跑（`--change <slug>`）；用觸發本次呼叫的 change slug 即可，因結果對同 schema 的所有 change 相同。
- `schema` 只用於組 cache key，**不進 argv**，故不引入新的注入面（Kotlin 的 slug 白名單維持不變、仍只驗 slug）。
- `readChange` 已於呼叫前算出 `schema`（`scanner.ts:259`，`readChangeSchema(changePath, defaultSchema)`），直接以第三引數傳下即可，無需多讀檔。
- 測試注入的 fake provider 需更新簽章（多一個參數），僅機械式調整。

**Alternatives considered:** 以 options 物件 `{ slug, schema }` 傳遞——對只有兩三個呼叫點的內部介面過度設計，位置參數更直接，且 Kotlin `fun interface` 對應更乾淨。否決。

### D3：Kotlin 鏡像同一修正

`SchemaOrder.kt` 的 `fun interface SchemaOrderProvider` 加 `schema` 參數，`cli` provider 以相同規則組 key（schema 已知用 schema、否則用 slug）。`ChangeReader` 呼叫端傳入該 change 的 schema。IntelliJ 目前付一樣的 per-change 成本，必須一起修才對齊。

### D4：in-flight 去重成為附帶紅利

provider 快取的是 Promise（TS）／完成後的值（Kotlin）。改以 schema 為 key 後，同時開啟多個共用同一 schema 的 change 會 dedupe 進同一次 spawn，而非各自 spawn。無需額外程式碼，行為自然更好。

## Risks / Trade-offs

- **[同 repo 內同名 schema 但定義相異]** → 在單一 `repoRoot` 下，schema 名稱唯一對應一份定義（讀自該 repo 的 openspec 設定），故同名即同義。跨 worktree 以不同 `repoRoot` 隔離。與現行 slug-key 對 repo 範圍的假設一致，無新增風險。
- **[schema 為 null 時未受益]** → 這類 change 退回 slug-key，效能同今天（沒有變差）。絕大多數 repo 的 change 都有可解析的 schema，主要痛點已消除。
- **[provider 簽章變更]** → 屬 `@spekjs/core` 內部介面，非公開 API 合約的一部分（外部消費者用的是 `readChange` / `ChangeDetail`，簽章不變）。仍會列入 core CHANGELOG（若適用），但不影響既有發佈版本的行為。
- **[驗證]** → 以單元測試斷言「同 schema 的第二個 slug 不再觸發 provider 呼叫、且拿到相同順序」；並保留「schema 為 null 時仍以 slug 分流」的既有覆蓋。TS + Kotlin 兩邊皆需。

## Correctness assumptions（此重鍵的正確性所倚賴，皆與 OpenSpec 模型一致）

1. **`actionContext.planningArtifacts` 的順序是 schema 的屬性、非個別 change 的 per-change 狀態。** 快取的是未 resolve 的 refs（schema 級），每次讀取仍以 `resolveSchemaOrder(refs, 該 change 自己的 artifact ids)` 逐 change 過濾，故 artifact **集合**不同不成問題；只有當兩個同名 schema 的 change 得到不同的**相對順序**時才會出錯。這正是 issue #15 的前提（「每個 spec-driven change 得到相同答案」）。
2. **本地解析出的 schema（`.openspec.yaml schema:` → repo config fallback）等於 CLI 以 `--change <slug>` 實際採用的 schema。** 危險方向僅有「我們判為相同、CLI 判為不同」——反向只是少一次快取共用、不致出錯。

## Accepted test boundary

「真實 `cliSchemaOrderProvider` 快取把**非 null** 的權威順序供給第二個不同 slug」這一段是**整合邊界**：需真的 `openspec` CLI 或把 spawn 做成可注入才能在單元層直接斷言，兩者皆與本 repo 既有的 spawn 整合邊界慣例（該層以整合而非單元測試覆蓋）相悖。故以（a）promise 同一性單元測試證「不再 spawn」、（b）`resolveSchemaOrder` 逐 change 映射的 scanner 測試、（c）手動量測（A cold 1116ms → B 同 schema 1.5ms 命中）三者合證，不為此單一整合縫引入生產端 DI。
