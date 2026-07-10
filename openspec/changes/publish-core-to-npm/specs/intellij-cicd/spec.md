## MODIFIED Requirements

### Requirement: Full build chain execution
Workflow SHALL 依序執行完整 build chain：install npm dependencies → build @spekjs/core → build IntelliJ webview assets → setup JDK 17 → build IntelliJ Plugin via Gradle。

#### Scenario: Build chain completes successfully
- **WHEN** workflow 被觸發且所有 build 步驟成功
- **THEN** `packages/intellij/build/distributions/spek-intellij-*.zip` 存在且為最新

#### Scenario: Build failure stops pipeline
- **WHEN** 任一 build 步驟失敗
- **THEN** 後續步驟不執行，workflow 標記為失敗
