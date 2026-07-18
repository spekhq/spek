## MODIFIED Requirements

### Requirement: Release skill covers IntelliJ
`/release` skill SHALL 在 release 流程中處理 IntelliJ 相關的版號、CHANGELOG 和 change notes 更新。

#### Scenario: Release skill updates IntelliJ CHANGELOG
- **WHEN** 執行 `/release` skill 的 CHANGELOG 更新步驟
- **THEN** `packages/intellij/CHANGELOG.md` 與 root、vscode 同步更新

#### Scenario: Release skill syncs plugin.xml change-notes
- **WHEN** 執行 `/release` skill 的 CHANGELOG 更新步驟
- **THEN** `packages/intellij/src/main/resources/META-INF/plugin.xml` 的 `<change-notes>` 區塊 SHALL 同步更新為該版本的變更摘要（HTML 格式 `<ul><li>` 列表）

#### Scenario: Release skill push message
- **WHEN** release skill 顯示 push 確認訊息
- **THEN** 訊息 SHALL 提及 JetBrains Marketplace 發佈
