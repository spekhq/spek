## MODIFIED Requirements

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
