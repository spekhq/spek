## 1. 清理 core 的 runtime 依賴

> 先做這一節，讓後續改名的 diff 保持單純。

- [x] 1.1 `packages/core/package.json` 的 `dependencies` 縮為 `{ cross-spawn }`，移除 `fuse.js` 與 `gray-matter`（core 的 `src` 與 `dist` 皆零引用）
- [x] 1.2 執行 `npm install` 更新 lockfile，確認 `packages/web` 與 `packages/vscode` 仍能各自解析到自己宣告的 `fuse.js`
- [x] 1.3 跑 `npm run test -w @spek/core` 與 `npm run type-check`，確認移除依賴未造成回歸
- [x] 1.4 跑 `npm run build:web`、`npm run build:webview`、`npm run build:vscode`、`npm run build:intellij`、`npm run build:demo`，確認五個建置目標皆通過

## 2. 套件更名（`@spek/core` → `@spekjs/core`，`@spek/web` → `@spekjs/web`）

> 兩個名稱**分別精確匹配**，嚴禁對 `@spek/` 前綴做通用替換 —— 那會同時打到兩者，並掃進歷史檔。

- [x] 2.1 `packages/core/package.json` 的 `name` 改為 `@spekjs/core`
- [x] 2.2 `packages/web/package.json` 的 `name` 改為 `@spekjs/web`，其 `dependencies` 中的 core 依賴改為 `"@spekjs/core": "*"`
- [x] 2.3 `packages/vscode/package.json` 的 `dependencies` 中的 core 依賴改為 `"@spekjs/core": "*"`
- [x] 2.4 更新 `packages/web` 的 24 個檔案、`packages/vscode` 的 5 個、`packages/intellij` 的 5 個（Kotlin 註解與測試）、`packages/core` 的 3 個
- [x] 2.5 更新 root `package.json` 的 scripts（`-w @spek/core`、`-w @spek/web`）
- [x] 2.6 更新 `.github/workflows/vscode-publish.yml` 與 `.github/workflows/intellij-publish.yml`，以及 `action.yml`
- [x] 2.7 更新 `README.md`、`README.zh-TW.md`、`CLAUDE.md` 中的套件名與指令範例
- [x] 2.8 手動同步 `openspec/specs/{core-module,dev-environment-setup,vscode-extension-host}/spec.md` 的 `## Purpose` 區塊 —— delta 只表達 requirement，archive 不會碰 Purpose
- [x] 2.9 驗證歷史未被污染：`git diff --stat` 對 `openspec/changes/`、三份 `CHANGELOG.md`、`docs/change-lifecycle-roadmap.md` 皆為空
- [x] 2.10 驗證殘留為 0：排除歷史檔、`node_modules`、`dist`、以及 `openspec/specs` 的 requirement 區塊後，`@spek/core` 與 `@spek/web` 皆無殘留

## 3. 發佈設定與周邊檔案

- [x] 3.1 `packages/core/package.json`：`private` 改為 `false`、`version` 改為 `1.0.0`、加上 `publishConfig: { access: "public" }`
- [x] 3.2 `packages/core/package.json` 加上 `files: ["dist", "CHANGELOG.md"]`（npm 自動含 `package.json` / `README` / `LICENSE`，但**不會**自動含 `CHANGELOG.md`）
- [x] 3.3 `packages/core/package.json` 加上 `repository: { type, url, directory: "packages/core" }`
- [x] 3.4 複製 root 的 MIT `LICENSE` 至 `packages/core/LICENSE`（npm tarball 只含 package 目錄，不會帶上 repo 根的授權檔）
- [x] 3.5 新增 `packages/core/README.md`，作為 npm 套件頁面的內容（安裝、`scanOpenSpec` 等主要 API、三個 subpath exports）
- [x] 3.6 新增 `packages/core/CHANGELOG.md`，首篇 `## 1.0.0` 記錄：首次發佈、自 `@spek/core` 更名、runtime 依賴精簡
- [x] 3.7 確認 `exports` 的三個 subpath（`.`、`./headings`、`./artifact-order`）在 `dist/` 中都有對應的 `.js` 與 `.d.ts`

## 4. 重新產生建置產物

> 這些是產物，不可手動改名 —— 手動改了下次重新產生就會被蓋掉。

- [x] 4.1 執行 `npm install`，讓 `package-lock.json` 反映新的套件名與精簡後的依賴
- [x] 4.2 執行 `npm run build:demo`，重新產生 `docs/demo.html`
- [x] 4.3 確認 `package-lock.json` 已無 `@spek/core` 與 `@spek/web`。`docs/demo.html` **必然殘留舊名**（實測 198 + 30 處）—— 它內嵌 spek 自身的 openspec 內容，而 archived change 的原文永遠記載當時的套件名；此處只需確認它已由 `build:demo` 重新產生

## 5. 發佈前檢查

> 第 6 節是**不可逆點**。`npm unpublish` 僅限發佈後 72 小時內，且該版本號永久不可重用。
> 本節是唯一的把關關卡，必須全部通過才進入第 6 節。

- [x] 5.1 執行 `npm pack --dry-run -w @spekjs/core`，確認 tarball 含 `dist/` 的 `.js` 與 `.d.ts`、`package.json`、`README.md`、`LICENSE`、`CHANGELOG.md`
- [x] 5.2 確認 tarball **不含** `src/`
- [x] 5.3 確認發佈用的 `package.json` 中 `dependencies` 只有 `cross-spawn`、`private` 為 `false`、`version` 為 `1.0.0`、`publishConfig.access` 為 `public`
- [x] 5.4 確認 npm 登入身分為 `kewangtw` 且為 `spekjs` org 的成員（`npm whoami`、`npm org ls spekjs`）
- [x] 5.5 確認具備**可發佈**的認證方式。`npm profile get` 顯示 `two-factor auth: disabled` **不足以**發佈 —— npm 要求 publish 必須通過 2FA，或使用啟用 *Bypass 2FA* 的 granular access token，否則 registry 回 `403`（實測）。需擇一：啟用帳號 2FA（發佈時帶 `--otp=<code>`），或於 npmjs.com 建立 granular access token（授予 `@spekjs/*` read/write + Bypass 2FA）並寫入 `~/.npmrc`

## 6. 發佈與驗證（不可逆）

- [x] 6.1 執行 `npm publish -w @spekjs/core`
- [x] 6.2 `npm view @spekjs/core version` 取得得到 `1.0.0`
- [x] 6.3 在乾淨目錄執行 `npm install @spekjs/core`，實際 `import { scanOpenSpec }` 並對一個含 `openspec/` 的 repo 呼叫一次，確認回傳結構正確
- [x] 6.4 在同一乾淨目錄驗證 subpath：`import` `@spekjs/core/headings` 與 `@spekjs/core/artifact-order` 皆可解析（含型別）
- [x] 6.5 確認乾淨環境的 `node_modules` 中未安裝 `fuse.js` 與 `gray-matter`

## 7. 回歸與文件

- [x] 7.1 `npm run type-check` 通過
- [x] 7.2 `npm run test -w @spekjs/core` 通過
- [x] 7.3 五個建置目標（`build:web`、`build:webview`、`build:vscode`、`build:intellij`、`build:demo`）皆通過，四種既有使用方式未破損
- [x] 7.4 更新 `CLAUDE.md` 的 CHANGELOG 慣例：三份 CHANGELOG 是「共享 spek 產品的版本歷史，各自過濾掉與該發行通道無關的條目」（並非逐字一致），且 `packages/core` 有獨立的版本線與獨立的 `CHANGELOG.md`
- [x] 7.5 更新 `CLAUDE.md` 的 Tech Stack 與 Development Commands 段落，反映新的套件名與 core 的發佈狀態
