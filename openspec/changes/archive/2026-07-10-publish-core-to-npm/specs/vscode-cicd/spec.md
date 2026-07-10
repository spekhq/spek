## MODIFIED Requirements

### Requirement: Full build chain execution
Workflow SHALL 依序執行完整 build chain：install dependencies → build @spekjs/core → build webview assets → build VS Code extension。

#### Scenario: Build chain completes successfully
- **WHEN** workflow 被觸發且所有 build 步驟成功
- **THEN** `packages/vscode/dist/extension.js` 和 webview assets 皆存在且為最新

#### Scenario: Build failure stops pipeline
- **WHEN** 任一 build 步驟失敗
- **THEN** 後續步驟不執行，workflow 標記為失敗
