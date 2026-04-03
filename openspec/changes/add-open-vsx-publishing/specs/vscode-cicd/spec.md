## ADDED Requirements

### Requirement: Open VSX Registry publish
Workflow SHALL 使用 `OVSX_PAT` secret 透過 `ovsx publish` 將 extension 發佈到 Open VSX Registry。

#### Scenario: Successful Open VSX publish
- **WHEN** build chain 完成且 `OVSX_PAT` secret 有效
- **THEN** extension 成功發佈到 Open VSX Registry

#### Scenario: Missing OVSX PAT secret
- **WHEN** `OVSX_PAT` secret 未設定或已過期
- **THEN** Open VSX publish 步驟失敗，workflow 標記為失敗

### Requirement: Single package artifact
Workflow SHALL 先執行 `vsce package` 產出 `.vsix` 檔案，再分別用此檔案發佈到 VS Code Marketplace 和 Open VSX Registry。

#### Scenario: Package once publish twice
- **WHEN** workflow 執行 publish 流程
- **THEN** 僅產出一次 `.vsix` 檔案，且兩個 registry 皆使用同一份 `.vsix` 發佈

## MODIFIED Requirements

### Requirement: Marketplace publish
Workflow SHALL 使用 `VSCE_PAT` secret 透過 `vsce publish --packagePath` 將預先打包的 `.vsix` 檔案發佈到 VS Code Marketplace。

#### Scenario: Successful publish
- **WHEN** build chain 完成且 `VSCE_PAT` secret 有效且 `.vsix` 檔案存在
- **THEN** extension 成功發佈到 VS Code Marketplace

#### Scenario: Missing PAT secret
- **WHEN** `VSCE_PAT` secret 未設定或已過期
- **THEN** publish 步驟失敗，workflow 標記為失敗
