## 1. 修改 GitHub Actions Workflow

- [x] 1.1 將 `vsce publish` 改為 `vsce package --no-dependencies -o spek.vsix` 先打包
- [x] 1.2 新增 `vsce publish --no-dependencies --packagePath spek.vsix` 步驟發佈到 VS Code Marketplace
- [x] 1.3 新增 `npx ovsx publish spek.vsix -p "$OVSX_PAT"` 步驟發佈到 Open VSX Registry

## 2. 驗證

- [x] 2.1 確認 workflow YAML 語法正確
