# Tasks

## 1. TS core — 修正 CRLF 解析（Bug 2）

- [x] 1.1 `packages/core/src/scanner.ts` 的 `parseChangeYaml` 將 `content.split("\n")` 改為 `content.split(/\r?\n/)`
- [x] 1.2 `packages/core/src/scanner.test.ts` 補測試：`.openspec.yaml` 內容以 CRLF（`\r\n`）換行含 `created: 2026-07-05` 時，`createdDate` 應為 `"2026-07-05"`（並保留既有 LF case 為回歸保護）
- [x] 1.3 跑 `npm run test -w @spek/core`，確認含 CRLF 的新測試與既有測試全綠

## 2. IntelliJ Kotlin core — 讀取 createdDate / archivedDate（Bug 1）

- [x] 2.1 `packages/intellij/.../core/Models.kt`：`ChangeInfo` 新增 `val createdDate: String? = null` 與 `val archivedDate: String? = null`
- [x] 2.2 `Models.kt`：`ChangeDetail` 新增 `val createdDate: String? = null` 與 `val archivedDate: String? = null`
- [x] 2.3 `packages/intellij/.../core/OpenSpecScanner.kt`：新增 `readCreatedDate(changeDir): String?`（讀 `.openspec.yaml`、以 `readLines()` 取 `created:`、驗證 `^\d{4}-\d{2}-\d{2}$`，缺檔／不符回 null）；`scanChangeDir` 以此填 `createdDate`，並在 `status == "archived"` 時以 `parseSlug` 的 `date` 填 `archivedDate`、active 為 null
- [x] 2.4 `packages/intellij/.../core/ChangeReader.kt`：`read()` 重用 `OpenSpecScanner.readCreatedDate` 填 `createdDate`，並依 change 位於 `changes/` 或 `changes/archive/<slug>` 判定 `archivedDate`（archived 由 slug 前綴推導、active 為 null），回填至 `ChangeDetail`

## 3. IntelliJ 測試設施（design D4）

- [x] 3.1 `packages/intellij/build.gradle.kts`：加入 JUnit 5 `testImplementation` 依賴與 `tasks.test { useJUnitPlatform() }`
- [x] 3.2 新增 `packages/intellij/src/test/kotlin/.../core/OpenSpecScannerTest.kt`：以臨時目錄涵蓋 active 讀 createdDate、archived 讀 createdDate + archivedDate、缺 `.openspec.yaml` 回 null、格式錯回 null、CRLF `.openspec.yaml` 仍讀得到
- [x] 3.3 跑 `./gradlew test`（在 `packages/intellij`），確認測試全綠（5 tests, 0 fail）

## 4. 前端空狀態文案（design D5）

- [x] 4.1 `packages/web/src/pages/TimelinePage.tsx`：將「全部 change 缺 createdDate」時的空狀態文字改為中性描述（陳述目前無可用建立日期），移除單一斷言使用者未填 `created:` 的措辭；判斷邏輯不變

## 5. 建置與型別驗證

- [x] 5.1 跑 `npm run type-check`，確認全專案型別無誤
- [x] 5.2 跑 `npm run build:core` 與 `npm run build:intellij`，確認 core 與 IntelliJ webview assets 可正常產出

## 6. 文件

- [x] 6.1 三份 CHANGELOG 同步新增本次修復條目：`CHANGELOG.md`、`packages/vscode/CHANGELOG.md`、`packages/intellij/CHANGELOG.md`（內容一致）
- [x] 6.2 檢查 `CLAUDE.md` IntelliJ API 段落是否需補述 changes 回應含 `createdDate` / `archivedDate`，需要則更新
