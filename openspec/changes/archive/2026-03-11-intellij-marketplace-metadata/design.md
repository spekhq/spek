## Context

IntelliJ plugin（`tw.kewang.spek`）已上架 JetBrains Marketplace（v0.1.1），但 Marketplace 頁面缺少多項關鍵元資料：無 plugin icon、description 過於簡短、無 change notes、vendor 資訊不完整。

此外，IntelliJ plugin 版號與主專案脫節（0.1.1 vs 0.7.2），release 流程（`/release` skill）只處理 root + VS Code，未涵蓋 IntelliJ。

目前版號同步機制：
- `package.json` 的 `version` script 在 `npm version` 時自動同步 `packages/vscode/package.json`
- `gradle.properties` 的 `pluginVersion` 完全獨立，需手動更新

## Goals / Non-Goals

**Goals:**
- Marketplace 頁面呈現完整且專業的 plugin 資訊
- 每次 release 自動同步 IntelliJ 版號、CHANGELOG、change notes
- 三份 CHANGELOG（root、vscode、intellij）內容一致
- `/release` skill 一次搞定所有平台

**Non-Goals:**
- 不新增截圖到 Marketplace（需手動上傳，非 build 自動化範圍）
- 不修改 CI/CD workflow 結構（tag-triggered 機制維持不變）

## Decisions

### 1. Plugin Icon 規格與位置
**決定**：新增 `pluginIcon.svg`（40x40px）至 `src/main/resources/META-INF/`

**理由**：JetBrains Marketplace 會自動從 JAR 中的 `META-INF/pluginIcon.svg` 讀取 icon。此為 IntelliJ Platform 標準慣例，無需額外設定。

### 2. Description 來源
**決定**：在 `plugin.xml` 的 `<description>` CDATA 區塊中撰寫完整的 HTML 描述，`build.gradle.kts` 的 description 保持簡短摘要。

**理由**：JetBrains Plugin SDK 優先使用 `plugin.xml` 中的 description，且支援 HTML 格式（`<ul>`、`<b>`、`<a>` 等），能呈現更豐富的內容。

### 3. Change Notes 機制
**決定**：在 `plugin.xml` 中新增 `<change-notes>` 區塊，每次發版由 release skill 自動更新。

**理由**：`<change-notes>` 直接顯示在 Marketplace 的 "What's New" 區塊。由 release skill 自動從 CHANGELOG 內容產生，確保一致性。

### 4. 版號同步策略
**決定**：擴充 `package.json` 的 `version` script，在 `npm version` 執行時同時寫入 `packages/intellij/gradle.properties` 的 `pluginVersion`。IntelliJ 版號從 0.1.1 直接跳到與主專案對齊的下一版。

**理由**：延續現有的 VS Code 版號同步機制（`version` lifecycle script），保持一致的自動化模式。使用者只需執行一次 `npm version`，所有平台版號自動對齊。

**替代方案**：獨立維護 IntelliJ 版號 → 棄選，增加維護負擔且容易忘記更新。

### 5. CHANGELOG 同步
**決定**：`packages/intellij/CHANGELOG.md` 內容與 root `CHANGELOG.md` 和 `packages/vscode/CHANGELOG.md` 完全一致，三份同步。

**理由**：spek 是同一產品的不同平台版本，功能更新基本同步，維護三份不同內容的成本遠大於保持一致。

### 6. Release Skill 擴充
**決定**：更新 `/release` skill，新增：
- 步驟 3 同時更新 `packages/intellij/CHANGELOG.md`
- `version` script 自動處理 `gradle.properties` 同步
- 步驟 7 的 push 說明加入 JetBrains Marketplace
- Guardrails 加入三份 CHANGELOG 同步規則

**理由**：集中管理 release 流程，避免遺漏任何平台。

### 7. Vendor 資訊
**決定**：在 `build.gradle.kts` 和 `plugin.xml` 中補充 vendor url，指向 GitHub repo。

**理由**：讓使用者能從 Marketplace 快速找到原始碼和回報問題。

## Risks / Trade-offs

- **[版號跳躍]** IntelliJ 從 0.1.1 跳到 0.7.x+ → 可接受，明確表達是同一產品
- **[三份 CHANGELOG 維護]** 多一份要同步 → 已透過 release skill 自動化，風險低
- **[version script 複雜度增加]** 需解析 gradle.properties → 單行 sed 即可，複雜度有限
