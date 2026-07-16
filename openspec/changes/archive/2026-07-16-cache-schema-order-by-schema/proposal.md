## Why

開啟任一 active change 的 detail 頁要花 **~1.25 秒**，幾乎全部耗在為了算 `schemaOrder` 而 spawn 一次 `openspec` CLI（Node 行程啟動成本）。但 CLI 回傳的 `actionContext.planningArtifacts` + `artifactPaths` 是**該 schema 的屬性，不是該 change 的**——同一 repo 內每個 `spec-driven` change 問到的答案完全相同。目前的 cache 卻以 change slug 為 key（`schema-order.ts:103`、`SchemaOrder.kt:108`），於是每開一個不同 slug 的 change 就重付一次 1.25 秒；而這個值預設根本用不到（預設排序是 Last modified，只有使用者切到 Schema order 才會用）。

## What Changes

- 把 schema-order 的 cache key 從**以 change 為單位**（`${repoRoot}::${slug}`）改為**以 schema 為單位**（`${repoRoot}::${schema}`）：CLI 仍需要*某個* slug 才能執行，但結果對每個共用同一 schema 的 change 都可復用。
- 為此把 change 的 schema 名稱傳入 `SchemaOrderProvider`（provider 簽章新增 schema 參數）；`readChange` 已在呼叫前算出 `schema`（`scanner.ts:259`），直接傳下去即可。
- schema 為 `null`/未知時 fallback 回以 slug 為 key（維持既有行為，不同名的無-schema change 不會互相污染）。
- 在 Kotlin core 鏡像同一修正（`SchemaOrder.kt`），IntelliJ plugin 目前付一樣的成本。
- 純快取層修正，**無 API、無 UI、無輸出變更**：同一組輸入的 `schemaOrder` 結果不變，只是少 spawn 幾次。

## Capabilities

### New Capabilities
<!-- 無新增 capability -->

### Modified Capabilities
- `custom-schema-artifacts`: 為「Schema order sourced from the OpenSpec authority」補上一條快取粒度保證——權威順序既是 schema 的屬性，系統在快取窗內對每個 distinct schema 至多 spawn CLI 一次（而非每個 change 一次）；schema 未知時退回以 change 為單位。此為可觀測的效能不變式（少 spawn），非僅實作細節。

## Impact

- **Code**: `packages/core/src/schema-order.ts`（provider 簽章 + cache key）、`packages/core/src/scanner.ts`（傳入 schema）、`packages/intellij/src/main/kotlin/com/spek/intellij/core/SchemaOrder.kt`（鏡像）。
- **Tests**: `packages/core/src/schema-order.test.ts`、`scanner.test.ts`（provider 注入點簽章更新）、Kotlin `src/test/kotlin` 對應測試。
- **API / UI / adapters**: 無變更。`ChangeDetail.schemaOrder` 合約與前端排序控制皆不動。
- **後續（不在本 change）**: 真正 lazy 化（只在使用者選 Schema order 時才取）需跨三個前端加端點，成本大得多；本 change 先以低成本吃掉大部分痛點，待量測後再議。
