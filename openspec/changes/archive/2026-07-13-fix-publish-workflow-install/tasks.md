## 1. 讓 install 不再 build ui

- [x] 1.1 `packages/ui/package.json`：`"prepare": "npm run build"` → `"prepublishOnly": "npm run build"`，讓 dist 只在 `npm publish` 時產生，不在 `npm ci` / `npm install` 期間產生。

## 2. 補回 workflow 缺的 ui build

- [x] 2.1 `.github/workflows/vscode-publish.yml`：webview 步驟由 `npm run build:webview -w @spekjs/web` 改為 root 的 `npm run build:webview`（先 build ui 再 build webview）。IntelliJ workflow 走的 `npm run build:intellij` 已含 build ui，無須更動。

## 3. 驗證

- [x] 3.1 在乾淨 clone（無既有 `node_modules`）跑 `npm ci`，確認不再失敗 —— 這是本機用既有 `node_modules` 測不出來的關鍵條件。
- [x] 3.2 在同一個乾淨 clone 依序跑兩條 workflow 的 build 步驟（`build -w @spekjs/core` → `build:webview` → `build -w spek-vscode`；`build -w @spekjs/core` → `build:intellij`），確認皆成功。
- [x] 3.3 重新派工兩個發佈 workflow，確認 VS Code Marketplace / Open VSX / JetBrains Marketplace 皆發佈成功。
