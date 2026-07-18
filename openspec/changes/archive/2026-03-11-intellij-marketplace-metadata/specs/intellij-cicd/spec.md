## MODIFIED Requirements

### Requirement: Version consistency check
Workflow SHALL 在 publish 前驗證 tag 版號與 `packages/intellij/gradle.properties` 中的 `pluginVersion` 欄位一致。由於版號現在透過 `npm version` 自動同步，此檢查確保同步機制正常運作。

#### Scenario: Version matches
- **WHEN** tag `v0.8.0` 且 gradle.properties pluginVersion 為 `0.8.0`
- **THEN** 繼續執行 publish

#### Scenario: Version mismatch
- **WHEN** tag `v0.8.0` 但 gradle.properties pluginVersion 為 `0.7.2`
- **THEN** workflow 失敗並輸出版號不一致的錯誤訊息
