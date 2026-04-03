## Context

目前 VS Code extension 的 CI/CD workflow（`.github/workflows/vscode-publish.yml`）在 tag push 時直接執行 `vsce publish`，僅發佈到 VS Code Marketplace。需要擴展為同時發佈到 Open VSX Registry。

## Goals / Non-Goals

**Goals:**
- 同一次 CI/CD 執行同時發佈到 VS Code Marketplace 和 Open VSX Registry
- 只打包一次 `.vsix`，確保兩邊發佈的是同一份產物

**Non-Goals:**
- 不改動 build chain 或 extension 本身的程式碼
- 不處理 Open VSX 的 namespace 註冊（手動完成）

## Decisions

### 先打包再發佈（Package-then-publish）

將目前的單步 `vsce publish` 改為三步：
1. `vsce package` 產出 `.vsix` 檔案
2. `vsce publish --packagePath` 用 `.vsix` 發佈到 VS Code Marketplace
3. `ovsx publish` 用同一份 `.vsix` 發佈到 Open VSX

**為什麼**：確保兩個 registry 收到完全相同的產物，避免重複 build 造成的不一致。

### 使用 `npx ovsx` 而非安裝為 devDependency

透過 `npx ovsx` 直接在 CI 中執行，不需在 `package.json` 新增依賴。

**為什麼**：`ovsx` 只在 CI 中使用，不需要汙染專案的依賴樹。

## Risks / Trade-offs

- **Open VSX PAT 過期** → 與 VSCE_PAT 相同管理方式，過期時 workflow 會失敗並通知
- **Open VSX 服務暫時不可用** → VS Code Marketplace 發佈不受影響（先執行），可手動重跑 workflow 補發
