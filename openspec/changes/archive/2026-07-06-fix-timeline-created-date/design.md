## Context

spek 有兩套各自獨立的 OpenSpec 掃描實作：Web / VS Code 走 TypeScript 的 `@spek/core`，IntelliJ plugin 走 Kotlin 重寫的 `com.spek.intellij.core`。前端 Timeline 頁對兩者共用，依 change 的 `createdDate`（由 `.openspec.yaml` 的 `created:` 解析而來）排時間軸。

現況兩個獨立缺陷都會讓 `createdDate` 遺失、Timeline 顯示「No timeline data」：

1. **IntelliJ（主因）**：Kotlin `ChangeInfo`（`Models.kt`）根本沒有 `createdDate` / `archivedDate` 欄位，`OpenSpecScanner.scanChangeDir` 也從不讀 `.openspec.yaml`。`/changes` 回應因此完全沒有這個 key，前端所有 change 都落入 unknownCreated。（`ChangeReader.readMetadata` 有讀 `.openspec.yaml`，但只供詳情頁 `metadata` map，且 `ChangeDetail` 同樣沒有 `createdDate` 欄位。）
2. **TS（次要）**：`parseChangeYaml`（`scanner.ts`）以 `content.split("\n")` 切行，CRLF 檔案每行尾留下 `\r`；正則 `^(\w+):\s*(.+)$` 中 `.` 不匹配 `\r`、`$`（無 `m` flag）只錨定字串結尾，導致 `created: 2026-07-05\r` 整行 match 失敗，`created` 從未被擷取。CRLF 的 `.openspec.yaml` 在 Web / VS Code 上同樣壞掉。

約束：IntelliJ 端目前**沒有任何測試設施**（無 `src/test`、build.gradle 無 test 依賴）；不希望為 bugfix 引入 YAML 函式庫或改動既有 API 契約（僅新增欄位）。

## Goals / Non-Goals

**Goals:**
- IntelliJ `/changes`（列表與詳情）回傳與 TS 契約一致的 `createdDate` / `archivedDate`，讓 IntelliJ 上 Timeline 正常運作。
- TS `parseChangeYaml` 對 CRLF 換行的 `.openspec.yaml` 正確解析 `created:`。
- 為兩處 bug 各補上可防 regression 的測試；尤其為 Kotlin core 建立最小測試基礎，因為「Kotlin 重寫版無測試、未隨 TS 同步」正是本 bug 的根因。

**Non-Goals:**
- 不改動 Timeline 前端的排序 / 分組 / 呈現邏輯（`grouping.ts`、`TimelineChart.tsx`）。
- 不引入 YAML 解析函式庫；沿用現有手寫的頂層 `key: value` 解析。
- 不擴大支援 `created:` 的其他寫法（引號包值、行首縮排）——非本次症狀，且 OpenSpec CLI 產出的檔案不會有；列入 Open Questions。
- 不變更 git timestamp 相關邏輯。

## Decisions

### D1: Kotlin 對齊 TS `readCreatedDate`，就地實作、不抽跨檔共用層
在 `OpenSpecScanner` 內新增私有 `readCreatedDate(changeDir): String?`：讀 `.openspec.yaml`、以既有 `readLines()`（本身就會吃掉 CRLF）取 `created:`、驗證 `^\d{4}-\d{2}-\d{2}$`，不符或缺檔回 `null`。`scanChangeDir` 以此填 `createdDate`；`archivedDate` 在 `status == "archived"` 時取 `parseSlug` 已解析出的 `date`、否則 `null`——完全對齊 TS `scanner.ts:79-81`。
- **為何不抽共用 helper**：`ChangeReader.readMetadata` 已存在且語意略不同（回傳整個 map 供詳情頁）。為單一欄位抽跨檔抽象反而增加耦合；兩處各自以極少行數讀取，重複成本低於抽象成本。
- **替代方案**：引入 SnakeYAML／kotlinx YAML → 否決，為 bugfix 增加執行期依賴不划算，且現有格式僅需頂層 `key: value`。

### D2: `ChangeDetail` 直接由既有 metadata map 補出兩欄
`ChangeReader.read` 已讀出 `metadata` map，可直接取 `metadata["created"]`（同樣驗證正則）填 `createdDate`；`archivedDate` 依 change 位於 `changes/` 或 `changes/archive/<slug>` 判定，archived 時由 slug 前綴推導。避免重複讀檔。

### D3: TS 修法用 `split(/\r?\n/)`
`parseChangeYaml` 將 `content.split("\n")` 改為 `content.split(/\r?\n/)`。最小、語意等同 Kotlin `readLines()`，一次涵蓋 CRLF 與 LF。
- **替代方案**：逐行 `line.replace(/\r$/, "")` 或放寬正則 → 同效但較不直觀；`split(/\r?\n/)` 最貼近意圖。

### D4: 為 Kotlin core 引入輕量 JUnit 5 測試，僅覆蓋無 platform 依賴的純邏輯
`OpenSpecScanner` / `ChangeReader` 只吃路徑字串、讀本機檔案，不依賴 IntelliJ platform，可用純 JUnit 5 + 臨時目錄測試，毋須 IntelliJ platform test fixtures。build.gradle.kts 加 `testImplementation` JUnit 5 與 `test { useJUnitPlatform() }`，新增 `src/test/kotlin`。
- **為何值得**：本 bug 的根因就是 Kotlin 版無測試、未隨 TS 演進；補最小測試基礎是對症的長期防護，成本可控（幾行 gradle + 一個 test class）。
- **CI 影響**：`buildPlugin`（intellij-cicd 的 build chain）不會自動觸發 `test`，故不影響現有發佈流程；是否將 `test` 納入 CI gating 屬後續，不在本 change。

### D5: 前端空狀態文案軟化（選配、低風險）
`TimelinePage` 空狀態不再單一斷言「請加上 `created:`」，改為中性描述（例如「這些 change 尚無可用的建立日期」）。純文案，不動判斷邏輯（仍以 `createdDate` 是否存在決定）。

## Risks / Trade-offs

- **[Gradle 測試依賴需下載，沙箱/CI 網路受限可能失敗]** → 測試相依僅標準 JUnit 5，走 mavenCentral；若本機環境無法下載，實作階段以本機可連網環境跑 `./gradlew test` 驗證，不阻擋 plugin build。
- **[IntelliJ 修好需重新打包、使用者須更新版本才生效]** → 屬預期；隨下一個 plugin release 發佈，並回覆回報者。
- **[CRLF 改動可能影響其他呼叫 `parseChangeYaml` 之處]** → 該函式僅新增容錯、不改既有 LF 行為；既有測試續綠即可佐證無回歸。
- **[`ChangeInfo` 新增 nullable 欄位的序列化]** → build.gradle.kts 已設 `Json { encodeDefaults = true }`，預設 `null` 會被序列化，前端早已容忍缺值，向下相容。

## Migration Plan

純 bugfix，無資料遷移。發佈路徑：`@spek/core` 隨 npm 版本、IntelliJ 隨 plugin release（tag 觸發 intellij-cicd）、Web/VS Code 隨各自版本。三份 CHANGELOG 同步。Rollback：revert 對應 commit 即可，無狀態殘留。

## Open Questions

- 是否要一併容忍 `created:` 的引號包值 / 行首縮排寫法？（review 指出這些也會解析失敗，但非本次症狀、OpenSpec CLI 不產生）暫列為未來強化，不納入本 change。
