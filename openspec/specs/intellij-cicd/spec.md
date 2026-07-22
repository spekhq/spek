# intellij-cicd Specification

## Purpose
TBD - created by archiving change add-intellij-publish-ci. Update Purpose after archive.
## Requirements
### Requirement: Tag-triggered publish workflow
系統 SHALL 提供 GitHub Actions workflow，於 push 符合 `v*` pattern 的 tag 時自動觸發 IntelliJ Plugin 的 build 與 publish 流程。

#### Scenario: Push version tag triggers workflow
- **WHEN** 開發者 push 一個 `v0.1.0` 格式的 tag
- **THEN** GitHub Actions workflow 自動觸發並執行完整 build chain

#### Scenario: Non-matching tag does not trigger
- **WHEN** 開發者 push 一個 `release-0.1.0` 或 `feat/something` 格式的 ref
- **THEN** 此 workflow 不被觸發

### Requirement: Full build chain execution
Workflow SHALL 依序執行完整 build chain：install npm dependencies → build @spekjs/core → build @spekjs/ui → build IntelliJ webview assets → setup JDK 17 → build IntelliJ Plugin via Gradle。webview assets 依賴 `@spekjs/ui` 的 dist，而 install 階段不會產生它（見 `ui-package`），故 build ui 屬於 build chain 的一環（由 root 的 `build:intellij` script 負責）。

#### Scenario: Build chain completes successfully
- **WHEN** workflow 被觸發且所有 build 步驟成功
- **THEN** `packages/intellij/build/distributions/spek-intellij-*.zip` 存在且為最新

#### Scenario: Build failure stops pipeline
- **WHEN** 任一 build 步驟失敗
- **THEN** 後續步驟不執行，workflow 標記為失敗

#### Scenario: Clean runner install
- **WHEN** workflow 在全新的 runner 上執行 `npm ci`（無既有 `node_modules`）
- **THEN** install 成功，不因任何 workspace 在 install 期間 build 而中止

### Requirement: JetBrains Marketplace publish
Workflow SHALL 使用 `JETBRAINS_MARKETPLACE_TOKEN` secret 透過 Gradle `publishPlugin` task 將 plugin 發佈到 JetBrains Marketplace。

#### Scenario: Successful publish
- **WHEN** build chain 完成且 `JETBRAINS_MARKETPLACE_TOKEN` secret 有效
- **THEN** plugin 成功發佈到 JetBrains Marketplace

#### Scenario: Missing token secret
- **WHEN** `JETBRAINS_MARKETPLACE_TOKEN` secret 未設定或已過期
- **THEN** publish 步驟失敗，workflow 標記為失敗

### Requirement: Manual trigger support
Workflow SHALL 支援 `workflow_dispatch` 手動觸發，方便除錯和測試。

#### Scenario: Manual trigger from Actions UI
- **WHEN** 開發者在 GitHub Actions UI 手動觸發此 workflow
- **THEN** workflow 執行完整 build + publish 流程

### Requirement: Version consistency check
Workflow SHALL 在 publish 前驗證 tag 版號與 `packages/intellij/gradle.properties` 中的 `pluginVersion` 欄位一致。由於版號現在透過 `npm version` 自動同步，此檢查確保同步機制正常運作。

#### Scenario: Version matches
- **WHEN** tag `v0.8.0` 且 gradle.properties pluginVersion 為 `0.8.0`
- **THEN** 繼續執行 publish

#### Scenario: Version mismatch
- **WHEN** tag `v0.8.0` 但 gradle.properties pluginVersion 為 `0.7.2`
- **THEN** workflow 失敗並輸出版號不一致的錯誤訊息

### Requirement: Gradle build caching
Workflow SHALL 使用 `actions/cache` 或 `gradle-build-action` 快取 Gradle dependencies，加速後續 CI 執行。

#### Scenario: Cache hit on repeated builds
- **WHEN** Gradle dependencies 未變更且 cache 存在
- **THEN** 跳過 dependency 下載，直接使用快取

### Requirement: Plugin Verifier compatibility gate
The publish workflow SHALL run IntelliJ Plugin Verifier against a configured set of IDE builds before publishing, and
SHALL fail the workflow on verification problems. The configured set SHALL include both ends of the supported range:
the oldest supported build (`since-build`) and the newest released IntelliJ Platform build.

#### Scenario: Verification passes
- **WHEN** Plugin Verifier reports no compatibility problems for every configured IDE build
- **THEN** the workflow SHALL proceed to publish

#### Scenario: Verification fails
- **WHEN** Plugin Verifier reports a compatibility problem for any configured IDE build
- **THEN** the workflow SHALL fail
- **AND** the plugin SHALL NOT be published

#### Scenario: Newest platform build is covered
- **WHEN** the verification target list is configured
- **THEN** it SHALL include the newest released IntelliJ Platform build, so that a platform change breaking the plugin
  is detected before release rather than by users

### Requirement: Documented limits of the verification gate
The limits of the verification gate SHALL be recorded rather than assumed away, and a compensating check SHALL be
identified for each of them. Plugin Verifier checks class resolution and API usage; it does not exercise UI behavior,
so some classes of breakage cannot be caught by the gate at all.

#### Scenario: Gate cannot detect a known failure mode
- **WHEN** Plugin Verifier is found not to report a failure mode the project cares about
- **THEN** that limitation SHALL be documented
- **AND** a compensating check SHALL be named, such as a unit test or a manual run on a real IDE
