## Purpose

提供 tag 觸發的 GitHub Actions workflow，自動建置並發佈 VS Code extension 至 Marketplace 與 Open VSX。

## Requirements

### Requirement: Tag-triggered publish workflow
系統 SHALL 提供 GitHub Actions workflow，於 push 符合 `v*` pattern 的 tag 時自動觸發 VS Code extension 的 build 與 publish 流程。

#### Scenario: Push version tag triggers workflow
- **WHEN** 開發者 push 一個 `v0.2.0` 格式的 tag
- **THEN** GitHub Actions workflow 自動觸發並執行完整 build chain

#### Scenario: Non-matching tag does not trigger
- **WHEN** 開發者 push 一個 `release-0.2.0` 或 `feat/something` 格式的 ref
- **THEN** 此 workflow 不被觸發

### Requirement: Full build chain execution
Workflow SHALL 依序執行完整 build chain：install dependencies → build @spekjs/core → build @spekjs/ui → build webview assets → build VS Code extension。webview assets 依賴 `@spekjs/ui` 的 dist，而 install 階段不會產生它（見 `ui-package`），故 workflow SHALL 呼叫會先 build ui 的 root script，而非 `@spekjs/web` 內的同名 script。

#### Scenario: Build chain completes successfully
- **WHEN** workflow 被觸發且所有 build 步驟成功
- **THEN** `packages/vscode/dist/extension.js` 和 webview assets 皆存在且為最新

#### Scenario: Build failure stops pipeline
- **WHEN** 任一 build 步驟失敗
- **THEN** 後續步驟不執行，workflow 標記為失敗

#### Scenario: Clean runner install
- **WHEN** workflow 在全新的 runner 上執行 `npm ci`（無既有 `node_modules`）
- **THEN** install 成功，不因任何 workspace 在 install 期間 build 而中止

### Requirement: Single package artifact
Workflow SHALL 先執行 `vsce package` 產出 `.vsix` 檔案，再分別用此檔案發佈到 VS Code Marketplace 和 Open VSX Registry。

#### Scenario: Package once publish twice
- **WHEN** workflow 執行 publish 流程
- **THEN** 僅產出一次 `.vsix` 檔案，且兩個 registry 皆使用同一份 `.vsix` 發佈

### Requirement: Marketplace publish
Workflow SHALL 使用 `VSCE_PAT` secret 透過 `vsce publish --packagePath` 將預先打包的 `.vsix` 檔案發佈到 VS Code Marketplace。

#### Scenario: Successful publish
- **WHEN** build chain 完成且 `VSCE_PAT` secret 有效且 `.vsix` 檔案存在
- **THEN** extension 成功發佈到 VS Code Marketplace

#### Scenario: Missing PAT secret
- **WHEN** `VSCE_PAT` secret 未設定或已過期
- **THEN** publish 步驟失敗，workflow 標記為失敗

### Requirement: Open VSX Registry publish
Workflow SHALL 使用 `OVSX_PAT` secret 透過 `ovsx publish` 將 extension 發佈到 Open VSX Registry。

#### Scenario: Successful Open VSX publish
- **WHEN** build chain 完成且 `OVSX_PAT` secret 有效
- **THEN** extension 成功發佈到 Open VSX Registry

#### Scenario: Missing OVSX PAT secret
- **WHEN** `OVSX_PAT` secret 未設定或已過期
- **THEN** Open VSX publish 步驟失敗，workflow 標記為失敗

### Requirement: Manual trigger support
Workflow SHALL 支援 `workflow_dispatch` 手動觸發，方便除錯和測試。

#### Scenario: Manual trigger from Actions UI
- **WHEN** 開發者在 GitHub Actions UI 手動觸發此 workflow
- **THEN** workflow 執行完整 build + publish 流程

### Requirement: Version consistency check
Workflow SHALL 在 publish 前驗證 tag 版號與 `packages/vscode/package.json` 中的 version 欄位一致。

#### Scenario: Version matches
- **WHEN** tag `v0.2.0` 且 package.json version 為 `0.2.0`
- **THEN** 繼續執行 publish

#### Scenario: Version mismatch
- **WHEN** tag `v0.3.0` 但 package.json version 為 `0.2.0`
- **THEN** workflow 失敗並輸出版號不一致的錯誤訊息
