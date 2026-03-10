## Why

IntelliJ Plugin 目前只能手動 build 和上傳到 JetBrains Marketplace，缺乏自動化發佈流程。專案已有 VS Code extension 的 CI/CD（tag-triggered GitHub Actions），IntelliJ Plugin 應採用相同模式，確保發佈流程一致且可重複。

## What Changes

- 新增 GitHub Actions workflow `intellij-publish.yml`，push `v*` tag 時自動 build 並發佈 IntelliJ Plugin 到 JetBrains Marketplace
- 在 `build.gradle.kts` 加入 `publishing` 設定，支援透過環境變數傳入 Marketplace token
- 加入版號一致性檢查（tag vs `gradle.properties` 中的 `pluginVersion`）

## Capabilities

### New Capabilities
- `intellij-cicd`: IntelliJ Plugin 的 GitHub Actions CI/CD 自動發佈流程，涵蓋 tag 觸發、build chain、Marketplace publish、版號驗證

### Modified Capabilities

（無）

## Impact

- 新增 `.github/workflows/intellij-publish.yml`
- 修改 `packages/intellij/build.gradle.kts`（加入 publishing block）
- 需要在 GitHub repo settings 設定 `JETBRAINS_MARKETPLACE_TOKEN` secret
