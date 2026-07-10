## Why

spek 的 core 是整個專案的 OpenSpec 解析引擎，但它從未離開這個 monorepo：`packages/core/package.json` 標記 `"private": true`、沒有 `files` 欄位、也沒有 `publishConfig`，只能被 spek 自己的 npm workspaces 解析。

下游需求已經出現。私有 repo `spek-workspace`（Electron agent 工作台）需要在 Electron 主行程直接 `import` core 的掃描 API。它是獨立的 repo，不是本 monorepo 的 workspace 成員，因此沒有任何合法管道安裝 core。

而且問題不只是「忘了發佈」。**`@spek` 這個 npm scope 已被他人註冊，本專案的 npm 帳號無權發佈至該 scope** —— 即使把 `private` 拿掉也發不出去。實測（皆以已知存在／不存在的 scope 當對照組）：`npm org ls` 對不存在的 scope 回 `exit 1` + `E404 Scope not found`，對 `spek` 回 `exit 0` + `{}`；`npm access list packages @spek` 回空，而對本帳號自己的 scope 會列出實際套件。佔用者發佈過 **0 個套件**，是佔名而非活躍專案。因此必須改名。

**為什麼是現在**：`spek-workspace` 的 Phase 0 已完成 30/37，剩下 7 個 task 全部阻塞在「取得 core 套件」這一件事上。同時這也兌現 spek 自己的定位 —— 讓 core 成為 OpenSpec 生態中任何工具都能消費的解析引擎，而不只是本 repo 的內部模組。

## What Changes

- **core 更名為 `@spekjs/core` 並首次發佈至 npm public registry。** npm org `spekjs` 已註冊完成，本帳號為 owner。
  - `packages/core/package.json`：`name` 改為 `@spekjs/core`、`private: false`、新增 `files` 與 `publishConfig.access: "public"`。
  - 確認 `exports` 的三個 subpath（`.`、`./headings`、`./artifact-order`）在發佈後仍能被外部消費者解析。
  - 補上發佈所需的周邊：package 層級的 `LICENSE`（npm tarball 只含 package 目錄，不會自動帶上 repo 根的授權檔）、供 npm 頁面顯示的 `README`、以及 monorepo 應有的 `repository.directory`。

- **`@spek/web` 一併更名為 `@spekjs/web`**，讓 monorepo 內的套件命名一致。它維持 `private: true`、不發佈、不佔用任何 npm scope；此舉純為命名一致。它在 `openspec/specs` 中**零引用**，因此不產生任何 delta spec。

- **同步 repo 內對兩個套件名的引用**（`@spek/core` 實測 223 行、128 個檔案）。此處的界線是本 change 最需要小心的部分，路徑分成三類（詳見 `design.md` D4）：
  - **手動改**：`packages/{core,web,vscode,intellij}` 的原始碼與 `package.json`、root `package.json` 的 scripts、`.github/workflows`（2 支）、`action.yml`、`README.md` / `README.zh-TW.md` / `CLAUDE.md`。
  - **重新產生，不手動改**：`package-lock.json`（`npm install`）、`docs/demo.html`（`npm run build:demo`）、`openspec/specs/**`（`openspec archive` 套用 delta 時自動更新）。
  - **絕不改（歷史記錄）**：`openspec/changes/`（`@spek/core` 68 檔、`@spek/web` 13 檔，含 `archive/`）；三份 `CHANGELOG.md` 的既有條目 —— 裡面的 `Add extractHeadings and slugifyHeading utilities to @spek/core`、`npm test -w @spek/web` 描述的是當時已發佈版本的事實，改掉會讓那些陳述變成假話；`docs/change-lifecycle-roadmap.md`（標有產出日期的規劃快照）。

- **發佈前清理 core 的 runtime 依賴**（此項於 `design.md` D2 由實測揭露，非原先預期）。core 目前宣告 `cross-spawn`、`fuse.js`、`gray-matter` 三個依賴，但 `core/src` 與 `dist` **只 import `cross-spawn`**。`fuse.js` 的真正使用者是 `packages/web`（已自行宣告）與 `packages/vscode`（`devDependencies`）；`gray-matter` 全 repo 零使用，且會拖進 `js-yaml@3.x`、`kind-of`、`section-matter`、`strip-bom-string`。若照現況發佈，每個下游都會被迫安裝一整串它們永遠用不到的套件。首次發佈定義了下游的安裝足跡，趁尚無外部消費者時清乾淨，成本最低。此舉不改動任何函式簽章或型別。

- **core 另立 `packages/core/CHANGELOG.md`**（`design.md` D7）。實測發現三份既有 CHANGELOG 並非逐字一致，真實慣例是「共享 spek 產品的版本歷史，各自過濾掉與該發行通道無關的條目」。core 發到 npm 後版本線獨立（`1.0.0` vs root 的 `1.5.0`）、讀者是開發者而非終端使用者，故另立一份；因 npm 不自動打包 `CHANGELOG.md`，須列入 `files`。三份既有 CHANGELOG 本次不新增條目 —— 本 change 不發佈 spek 產品新版，且 core 更名對終端使用者無可觀察的影響。`CLAUDE.md` 的相關慣例描述一併修正。

- **BREAKING（僅限 repo 內部）**：`@spek/core` 這個 import 路徑消失，四種既有使用方式（Web、VS Code Extension、IntelliJ Plugin、Demo）的建置鏈都要跟著改。**對 npm 生態不構成 breaking** —— 該套件從未發佈，沒有任何外部消費者。

- **明確不做**：不改動 core 的任何公開 API。函式簽章、型別、`exports` subpath 一律照舊；本 change 只換套件的識別名並讓它可被安裝。

## Capabilities

### New Capabilities

無。「發佈至 npm public registry」是 `core-module` 這個既有 capability 的一條新 requirement，而非新的能力面向 —— 它與該 capability 既有的 scanner / parser / 型別等 requirement 共用同一份 spec。

### Modified Capabilities

以下 10 個 spec 的 **requirement 正文或 scenario 直接寫著 `@spek/core`**（例如 `The scanner SHALL be an async function in the @spek/core package`、`WHEN the Express server imports @spek/core`）。套件名是這些規範內容的一部分，不只是說明文字，因此每個都需要 delta spec：

- `core-module`: `Standalone core package` 的套件名改變；**另新增** requirement —— 該套件須發佈至 npm public registry，且可被本 monorepo 以外的 repo 安裝。
- `openspec-scanner`: `scanOpenSpec` / `scanOpenSpecAggregated` 所屬套件名改變。
- `task-parser`: `parseTasks` 所屬套件名改變。
- `openspec-api`: `buildGraphData` / `buildGraphDataAggregated` 所屬套件名改變。
- `worktree-aggregation`: `listWorktrees` 所屬套件名改變。
- `markdown-renderer`: heading slug 須對齊的 `slugifyHeading` 來源套件名改變。
- `dev-environment-setup`: fresh-clone `npm install` 後應被編譯的套件名改變。
- `intellij-embedded-server`: Kotlin 版須對齊的 TypeScript contract 之套件名改變。
- `intellij-cicd`: build chain 中的套件名改變。
- `vscode-cicd`: build chain 中的套件名改變。

`vscode-extension-host` 僅在 `## Purpose` 段落提及套件名，屬描述性引用，隨文字同步即可，不需 delta spec。

## Impact

**套件識別**：`@spek/core` → `@spekjs/core`（發佈至 npm）；`@spek/web` → `@spekjs/web`（維持 private，不發佈）。（下游 `spek-workspace` 規劃於 Phase 5 抽出的 UI 套件對應命名為 `@spekjs/ui`，不在本 change 範圍。）

**建置鏈與 CI**：root `package.json` 的 `build:core`、`test -w @spek/core` 等 script；`packages/web` 與 `packages/vscode` 的 `dependencies`（目前皆為 `"*"`，指向 workspace）；`.github/workflows` 兩支；`action.yml`。

**版本與發版節奏**：core 目前為 `0.1.0`，獨立於 root 的 `1.5.0`。`design.md` D1 決定首次發佈為 `1.0.0` —— `^0.1.0` 只允許 `0.1.x`，而下游在其 Phase 1–3 還會要求 core 擴充 `listDir` / `readFile` / `writeFile` / `stat`；停在 `0.x` 會讓每次 additive 擴充都逼下游改版本範圍。

**安裝足跡**：core 的 `dependencies` 由三個縮為一個（僅 `cross-spawn`），下游不再被迫安裝 `fuse.js`、`gray-matter` 及其 transitive dependencies。

**發佈周邊**：`packages/core` 目前既無 `LICENSE` 也無 `README` —— npm tarball 只含 package 目錄，不會帶上 repo 根的授權檔。兩者皆須補齊，另加 `repository.directory`、`files`、`publishConfig.access`。

**不影響**：core 的公開 API surface 完全不變（函式簽章、型別、`exports` 的三個 subpath 一律照舊）。IntelliJ Plugin 是 Kotlin 重新實作、不 import 此套件，只在 spec 與 CI 描述中提及其名。

**下游解鎖**：`spek-workspace` 的 `workspace-foundation-spike` 有 7 個 task 阻塞於此，發佈後即可收尾 Phase 0。

**驗收邊界**：改名不得破壞四種既有使用方式。`npm run type-check`、`npm run test -w @spekjs/core`，以及 web / vscode / intellij / demo 的建置皆須通過。
