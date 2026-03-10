## 1. Plugin 命名與 Gradle 設定

- [x] 1.1 更新 `gradle.properties`：`pluginGroup` 改為 `tw.kewang.spek`
- [x] 1.2 更新 `build.gradle.kts`：`pluginConfiguration` 的 `id` 改為 `tw.kewang.spek`，`name` 改為 `spek-intellij`
- [x] 1.3 更新 `plugin.xml`：`<id>` 改為 `tw.kewang.spek`，`<name>` 改為 `spek-intellij`，`<vendor>` 改為 `kewang`
- [x] 1.4 在 `build.gradle.kts` 的 `intellijPlatform` block 加入 `publishing { token = providers.environmentVariable("PUBLISH_TOKEN") }`

## 2. GitHub Actions Workflow

- [x] 2.1 建立 `.github/workflows/intellij-publish.yml`，設定 `on: push: tags: ['v*']` 和 `workflow_dispatch` 觸發
- [x] 2.2 加入 Node.js setup（使用 `.nvmrc`）+ `npm ci` + build core + build intellij webview 步驟
- [x] 2.3 加入 JDK 17 setup（`actions/setup-java`）+ Gradle cache 設定
- [x] 2.4 加入版號一致性檢查步驟：比對 tag 版號與 `gradle.properties` 的 `pluginVersion`
- [x] 2.5 加入 `./gradlew publishPlugin` 步驟，傳入 `PUBLISH_TOKEN` 環境變數（來自 `secrets.JETBRAINS_MARKETPLACE_TOKEN`）
