## 1. TypeScript core (`@spekjs/core`)

- [x] 1.1 在 `schema-order.ts` 為 `SchemaOrderProvider` 型別新增第三參數 `schema`（最終定為**非 null** `string`：呼叫端保證只在有 schema 時才呼叫）
- [x] 1.2 在 `cliSchemaOrderProvider` 以 `${repoRoot}::${schema}` 為 cache key（純粹 schema 分桶，無 slug fallback、無 null 分支；TTL / size cap / spawn 邏輯不動；`schema` 不進 argv）
- [x] 1.3 在 `scanner.ts` 的 `readChange`：(a) 空 slug 提前回 null（空 slug 會指向 changes/ 目錄本身，配預設 schema 會污染該 schema 桶）；(b) 以 `status === "active" && schema` 守衛——無 schema 即不查 CLI，並把已算出的 `schema` 傳給 `orderProvider`

## 2. TypeScript tests

- [x] 2.1 `scanner.test.ts`：新增 provider 收到 `schema` 引數的斷言；既有兩個「active change → provider」測試補上 `.openspec.yaml` schema（原本無 schema，新守衛下本就不該呼叫 provider）
- [x] 2.2 新增測試：`cliSchemaOrderProvider` 同 schema 第二個 slug 命中同一 Promise（僅 spawn 一次）、不同 schema 分開 spawn（以 Promise 同一性驗證分桶）
- [x] 2.3 新增守衛測試：無 schema（無 config、無 change schema）→ provider **不被呼叫**、`schemaOrder` undefined；`schema: ""`（cleanScalar 產出 ""）等同無 schema → 不呼叫；空 slug → `readChange` 回 null 且不呼叫
- [x] 2.4 新增測試：兩個共用 schema 但 artifact 集合相異的 change，各自的 `schemaOrder` 只反映自身 artifact ids

## 3. Kotlin core mirror (IntelliJ)

- [x] 3.1 `SchemaOrder.kt` 的 `fun interface SchemaOrderProvider` 加 `schema: String`（**非 null**，Kotlin 型別強制）
- [x] 3.2 `cli` provider 以 `"$repoRoot::$schema"` 組 key（純 schema 分桶，無 fallback；slug 白名單注入防護維持不變）
- [x] 3.3 `ChangeReader.read`：空 slug 提前回 null；`status == "active" && !schema.isNullOrEmpty()` 守衛（smart-cast schema 為非 null）；新增可注入的 `orderProvider` 參數（對齊 TS `readChange`，利於測試）
- [x] 3.4 `ChangeReaderTest.kt`：注入計數 provider 驗證「無 schema / 空 schema / 空 slug → provider 不被呼叫」+ 正向對照（有 schema → 以正確 schema 呼叫）；移除已無意義的 `cacheKey` 單元測試

## 4. Verify

- [x] 4.1 `npm run test -w @spekjs/core`（125 pass）、`npm run type-check`、`npm run build` 皆綠
- [x] 4.2 IntelliJ：以 Temurin 17（已解決 Microsoft JDK 的 `instrumentCode` 環境 bug）跑完整 CI 等價流程 `clean test`（instrumentCode + instrumentTestCode 皆執行、無 skip）→ BUILD SUCCESSFUL、無 `w:` 警告；ChangeReaderTest 8、SchemaOrderTest 14，全數 0 fail
- [x] 4.3 手動量測：連開兩個共用 spec-driven schema 的 active change —— A cold ~1.1s（一次 spawn）、B 同 schema ~1.5ms（命中快取、未 spawn）。修正前 B 會再 spawn ~1.1s
- [x] 4.4 品質關卡：變異測試（`readChange` 守衛分岐全數被殺、無新增存活變異；唯一存活者為未改動的 metadata `existsSync`）、無新增未使用匯出、型別/LSP 診斷無回歸
- [x] 4.5 Playwright 端到端：full change 切「Schema order」→ tabs 重排為 spec-driven 權威序（Proposal, Design, Specs, Tasks）；空 change（無 artifact）優雅呈現（無 tab / 無排序控制 / 不崩潰）；全程 0 console error
