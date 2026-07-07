## Why

Timeline 頁依 change 的 `createdDate` 排時間軸，無 `createdDate` 者歸「Unknown created」。目前有兩個獨立 bug 會讓 `createdDate` 消失，導致即使 `.openspec.yaml` 正確填了 `created:`，Timeline 仍顯示「No timeline data」：IntelliJ plugin 的 Kotlin 後端根本沒讀 `created:`（影響全部 IntelliJ 使用者），而 TS 後端遇到 CRLF 換行的 `.openspec.yaml` 會解析失敗（影響 Web / VS Code 使用者）。兩者症狀相同、成因不同，且都是使用者無法自行修正的後端問題。

## What Changes

- **IntelliJ 後端讀取 `created:`**：Kotlin `ChangeInfo` model 補上 `createdDate` / `archivedDate` 欄位；`OpenSpecScanner.scanChangeDir` 讀取每個 change 的 `.openspec.yaml`、解析並驗證 `created:`（`^\d{4}-\d{2}-\d{2}$`），archived change 由資料夾名前綴推導 `archivedDate`、active 為 null，行為對齊 TS `scanner.ts`。
- **IntelliJ change 詳情對齊**：Kotlin `ChangeDetail` model 同步補上 `createdDate` / `archivedDate`，讓 IntelliJ 的 change 詳情頁 lifecycle 資訊與 Web / VS Code 一致。
- **TS parser 容錯 CRLF**：`parseChangeYaml` 改以 `/\r?\n/` 切行，修正 CRLF 換行的 `.openspec.yaml` 因尾端 `\r` 導致 `created:` 整行 match 失敗、`createdDate` 變 null 的問題。
- **前端空狀態文案（選配）**：軟化 Timeline 空狀態文字，不再在後端未回傳欄位時斷言「請為 change 加上 `created:`」，避免誤導已正確填寫的使用者。

以上皆為 bugfix，無 BREAKING 變更；API 回應僅新增欄位（TS 端早已有，IntelliJ 端補齊以達成 parity）。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `openspec-scanner`: 明確要求 `.openspec.yaml` 的 YAML 解析對 CRLF（`\r\n`）換行的檔案也能正確取出 `created:`，使 `createdDate` 不因換行風格而遺失。
- `intellij-embedded-server`: IntelliJ 內建 server 的 changes 回應（列表與詳情）SHALL 包含由 `.openspec.yaml` `created:` 解析的 `createdDate` 與推導的 `archivedDate`，與 TS 後端契約一致。
- `timeline-view`: 當所有 change 皆缺 `createdDate` 時的空狀態訊息不再單一歸因於「使用者未填 `created:`」。

## Impact

- **程式碼**
  - `packages/intellij/src/main/kotlin/com/spek/intellij/core/Models.kt`（`ChangeInfo`、`ChangeDetail` 加欄位）
  - `packages/intellij/src/main/kotlin/com/spek/intellij/core/OpenSpecScanner.kt`（`scanChangeDir` 讀 `.openspec.yaml`）
  - `packages/intellij/src/main/kotlin/com/spek/intellij/core/ChangeReader.kt`（詳情帶出 `createdDate` / `archivedDate`）
  - `packages/core/src/scanner.ts`（`parseChangeYaml` 換行切分）
  - `packages/web/src/pages/TimelinePage.tsx`（選配：空狀態文案）
- **測試**
  - Kotlin：`OpenSpecScanner` 讀取 `createdDate` 的測試（含 active / archived / 缺值 / 格式錯誤）
  - TS：`packages/core/src/scanner.test.ts` 補 CRLF `.openspec.yaml` case
- **API 契約**：IntelliJ `/api/spek/openspec/changes`、`/api/spek/openspec/changes/:slug` 回應新增 `createdDate` / `archivedDate` 欄位（前端已預期，向下相容）
- **文件**：`CHANGELOG.md`、`packages/vscode/CHANGELOG.md`、`packages/intellij/CHANGELOG.md` 三份同步新增條目
- **無 dependency 變更**
