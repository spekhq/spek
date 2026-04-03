## Why

目前 spek VS Code extension 僅發佈到 VS Code Marketplace，使用 VS Codium 或其他開源 VS Code 替代品的使用者無法從官方管道安裝。新增 Open VSX Registry 發佈可擴大使用者觸及範圍。

## What Changes

- GitHub Actions workflow 改為先打包 `.vsix` 再分別發佈到兩個 registry
- 新增 Open VSX Registry (`open-vsx.org`) 發佈步驟，使用 `ovsx` CLI
- 需要新增 `OVSX_PAT` GitHub secret

## Capabilities

### New Capabilities

（無新增 capability）

### Modified Capabilities

- `vscode-cicd`: 新增 Open VSX Registry 發佈需求，並改為先打包 `.vsix` 再發佈到兩個 registry

## Impact

- `.github/workflows/vscode-publish.yml`：修改 publish 流程
- GitHub repo settings：需新增 `OVSX_PAT` secret
- 無程式碼變更，僅 CI/CD workflow 調整
