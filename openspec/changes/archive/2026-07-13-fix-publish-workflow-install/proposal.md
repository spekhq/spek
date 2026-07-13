## Why

推 v1.6.1 的 tag 時，VS Code 與 IntelliJ 兩個發佈 workflow 都在第一步 `npm ci` 就失敗，沒有任何產物送出去。

`@spekjs/ui` 帶著 `"prepare": "npm run build"`。npm 在 `npm ci` 期間會執行 workspace 的 `prepare`，而那個時間點 workspace symlink（`node_modules/@spekjs/*`）還沒建好，所以 ui 的 `tsc` 解析不到 `@spekjs/core` 的型別宣告，build 失敗、整個 install 中止。

這個地雷在抽出 `@spekjs/ui` 時就埋下了，只是 v1.6.0 早於 ui 套件，v1.6.1 是它落地後第一次推 tag，才第一次引爆。本機不會重現：既有的 `node_modules` 是 `npm install` 累積出來的，symlink 早就在了。

順帶暴露出兩份 CI spec 的 build chain 描述在 ui 抽出後就過時了 —— 兩份都沒提到 `@spekjs/ui` 這一段。

## What Changes

- `@spekjs/ui` 改在**發佈時**而非**安裝時** build（`prepare` → `prepublishOnly`），install 不再依賴尚未建立的 workspace symlink。
- VS Code 的發佈 workflow 改呼叫 root 的 `build:webview`（會先 build ui 再 build webview），而非直接跳進 `@spekjs/web` 的同名 script。IntelliJ 的 workflow 本來就走 root 的 `build:intellij`（內含 build ui），不需更動。
- 兩份 CI spec 的 build chain 補上 `@spekjs/ui`；`ui-package` spec 記下「不在 install 時 build」這個約束與理由，避免日後有人把 `prepare` 加回來。

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `ui-package`: 套件的 dist 在發佈時產生，不在安裝時產生。
- `vscode-cicd`: build chain 明列 `@spekjs/ui`。
- `intellij-cicd`: build chain 明列 `@spekjs/ui`。

## Impact

- `packages/ui/package.json`（`prepare` → `prepublishOnly`）
- `.github/workflows/vscode-publish.yml`（webview 步驟改用 root script）
- 無程式碼變更，不影響 bundle 內容；發佈出去的產品程式碼與 v1.6.1 tag 上的內容一致。
