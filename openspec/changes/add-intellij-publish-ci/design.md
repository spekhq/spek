## Context

專案已有 `vscode-publish.yml` workflow 做為 VS Code extension 的自動發佈。IntelliJ Plugin 使用 Gradle + IntelliJ Platform SDK 建構，發佈目標為 JetBrains Marketplace。需新增類似的 GitHub Actions workflow。

現有 IntelliJ build 流程：
1. `npm run build -w @spek/core` — build 共用核心
2. `npm run build:intellij` — build webview 前端資源
3. `cd packages/intellij && ./gradlew buildPlugin` — build plugin zip

## Goals / Non-Goals

**Goals:**
- 自動化 IntelliJ Plugin 的發佈流程，與 VS Code extension 保持一致的 tag-triggered 模式
- 版號一致性驗證（tag vs `gradle.properties`）
- 支援手動觸發（`workflow_dispatch`）

**Non-Goals:**
- 不處理 plugin signing（JetBrains Marketplace 目前不強制要求）
- 不處理 plugin 的自動版號 bump（由既有 release skill 處理）
- 不建立合併的 unified publish workflow（VS Code 和 IntelliJ 保持獨立 workflow）

## Decisions

1. **Workflow 檔案命名**：`intellij-publish.yml`，對應既有的 `vscode-publish.yml`
2. **Token secret 名稱**：`JETBRAINS_MARKETPLACE_TOKEN`，透過環境變數 `PUBLISH_TOKEN` 傳入 Gradle
3. **Java 版本**：JDK 17，與 `build.gradle.kts` 中 `jvmToolchain(17)` 一致
4. **版號來源**：`gradle.properties` 中的 `pluginVersion`，用 grep 擷取做版號比對
5. **Publishing 設定**：在 `build.gradle.kts` 的 `intellijPlatform` block 加入 `publishing { token = providers.environmentVariable("PUBLISH_TOKEN") }`
6. **Node.js 版本**：使用 `.nvmrc` 讀取（與 vscode-publish 一致）

## Risks / Trade-offs

- **首次發佈需人工審核**：JetBrains Marketplace 首次上傳 plugin 需 1-2 個工作天人工審核，CI 只能自動化後續版本的更新
- **Gradle build 速度較慢**：相比 VS Code 的 npm build，Gradle 需要下載 IntelliJ Platform SDK，首次 CI run 可能較久。可透過 `actions/cache` 加速 Gradle 快取
