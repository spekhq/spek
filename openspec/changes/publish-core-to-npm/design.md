## Context

spek 的 core 從未離開這個 monorepo：`private: true`、無 `files`、無 `publishConfig`。下游私有 repo `spek-workspace` 需要以合法的 npm 依賴取得它，且該需求已阻塞其 Phase 0 的最後 7 個 task。

改名是必要的，不是偏好：**`@spek` 這個 npm scope 已被他人註冊**（佔用者 0 個套件），本帳號無權發佈至該 scope。npm org `spekjs` 已註冊完成，`kewangtw` 為 owner。

**撰寫本文件時對 repo 現況做了數項實測**，其中三項改變了本 change 的範圍：

1. `@spek/core` 共 223 行、128 個檔案的引用；`@spek/web` 另有數十處。其中 `openspec/changes/`（core 68 檔、web 13 檔）是歷史記錄。
2. **10 個 spec 的 requirement 正文或 scenario 直接寫著 `@spek/core`**，套件名是其規範內容的一部分。`@spek/web` 則在 `openspec/specs` 中**零引用**。
3. **core 宣告了兩個自己完全沒用到的 runtime 依賴。** `core/src` 與 `dist` 只 import `cross-spawn`（`schema-order.ts`）；`fuse.js` 的真正使用者是 `packages/web`（已自行宣告）與 `packages/vscode`（`devDependencies`，經 esbuild bundle）；`gray-matter` **全 repo 零使用**。

另外查清了兩件影響作法的事實：

- **三份 CHANGELOG 並非逐字一致。** 實測 `diff`：`packages/vscode/CHANGELOG.md` 少了一條純 Web 的條目，`packages/intellij/CHANGELOG.md` 另少了 VS Code sidebar 的條目。真實慣例是「共享同一份版本歷史，各自過濾掉與該發行通道無關的條目」，`CLAUDE.md` 的「內容必須保持一致」是不精確的描述。
- **`docs/demo.html` 與 `package-lock.json` 是建置產物**（前者由 `npm run build:demo` 產生），`openspec/specs/` 則由 `openspec archive` 套用 delta 自動更新。三者皆不應手動改名。

**約束**

- core 的公開 API surface 一個字都不能改 —— 函式簽章、型別、`exports` 的三個 subpath 全部照舊。
- 四種既有使用方式（Web、VS Code Extension、IntelliJ Plugin、Demo）不得破損。
- 歷史記錄不得改動：`openspec/changes/`、三份 `CHANGELOG.md` 的既有條目、`docs/change-lifecycle-roadmap.md`（標有產出日期的規劃快照）。

## Goals / Non-Goals

**Goals:**

- 讓 core 能被本 monorepo 以外的任何 repo 安裝並 `import`。
- 讓首次發佈的**安裝足跡是乾淨的** —— 下游不該被迫安裝 core 自己都不用的套件。
- 讓改名的波及範圍受控、可驗證，且歷史記錄不受污染。
- 套件命名在 monorepo 內一致：`@spekjs/core` 與 `@spekjs/web`。

**Non-Goals:**

- 不改動 core 的任何公開 API。
- 不發佈 `@spekjs/web`（維持 `private: true`；改名純為命名一致）。
- 不建立 CI 自動發佈流程；本次為手動發佈。
- 不抽出 `@spekjs/ui`（那是下游 `spek-workspace` Phase 5 的事）。
- 不為本次改名發佈 spek 產品的新版本（三份 CHANGELOG 不新增條目，見 D7）。

## Decisions

### D1：套件名 `@spekjs/core`，首次發佈版本 `1.0.0`

**名稱**：`@spek` 已被佔（實測：`npm org ls` 對不存在的 scope 回 `exit 1` + `E404 Scope not found`，對 `spek` 回 `exit 0` + `{}`；`npm access list packages @spek` 回空）。

| 替代方案 | 否決理由 |
|---|---|
| 維持 `@spek/core` | 不可行，本帳號無發佈權。 |
| `spek-core`（unscoped，已確認可用） | 無 namespace 保護；日後 `@spekjs/ui` 之類的同族套件會零散。 |
| `@kewangtw/spek-core`（user scope） | 可行且零成本，但名字綁個人帳號，與「成為 OpenSpec 生態的解析引擎」的定位衝突。 |
| 向 npm 申請 `@spek` name dispute | 佔用者 0 套件、符合閒置條件，但流程數週且不保證成功，不應阻塞下游。可作為長期並行動作。 |

**版本：`1.0.0`，而非沿用現有的 `0.1.0`。**

core 的 API 已被四個內部消費者（web / vscode / intellij / demo）長期驗證，並非實驗性質。更關鍵的是 semver 對 `0.x` 的處理：`^0.1.0` 只允許 `0.1.x`，minor 視同 breaking。下游 `spek-workspace` 在其 Phase 1–3 還會要求 core 擴充 `listDir` / `readFile` / `writeFile` / `stat` —— 若停在 `0.x`，**每一次 additive 擴充都會逼下游手動放寬版本範圍**。發 `1.0.0` 之後，additive 擴充走 minor，下游 `^1.0.0` 自動受惠。

真要做 breaking 變更時再發 `2.0.0`，那正是 semver 的用途。

### D2：發佈前把 core 的 runtime 依賴縮為 `cross-spawn` 一個

**這是 proposal 未預見、由實測揭露的範圍。**

| 依賴 | core 內實際使用 | 真正的使用者 | 處置 |
|---|---|---|---|
| `cross-spawn` | ✓ `src/schema-order.ts` | core 自己 | **保留** |
| `fuse.js` | ✗ 零引用 | `packages/web`（已自行宣告）、`packages/vscode`（devDependencies） | **移除** |
| `gray-matter` | ✗ 零引用 | 全 repo 無人使用 | **移除** |

`gray-matter` 還會拖進 `js-yaml@^3.13.1`、`kind-of`、`section-matter`、`strip-bom-string`。若照現況發佈，**每一個安裝 `@spekjs/core` 的下游都會被迫下載這一整串它們永遠用不到的套件**。

**為什麼必須在本 change 做**：首次發佈定義了下游的安裝足跡。等到有外部消費者之後才移除，雖然不是 API breaking，卻會讓那些（不該但確實）依賴 transitive dependency 的消費者破功。趁著還沒有任何外部消費者時清乾淨，成本最低、風險為零。

這不違反「不改公開 API」的約束：函式簽章與型別完全不變，改的只是 `package.json` 的 `dependencies`。

這件事本身也印證了 proposal 的論點 —— **讓自己成為第一個外部消費者，才會看見這個引擎對外好不好用。**

### D3：10 個 MODIFIED delta 以腳本生成，不手抄

OpenSpec 規定 `## MODIFIED Requirements` 底下必須放**完整**的 requirement 區塊（從 `### Requirement:` 到其所有 `#### Scenario:`）。instruction 明確警告：只寫部分內容會在 archive 時丟失細節。

10 個 spec、多個 requirement 區塊逐字手抄，漏掉一個 scenario 就會在 archive 時把它從主 spec 裡抹掉，**而且不會有任何錯誤訊息**。

**做法**：以腳本從 `openspec/specs/<capability>/spec.md` 擷取「內含 `@spek/core` 的 requirement 區塊」（從 `### Requirement:` 起，至下一個 `### ` 或 `## ` 前為止），僅將套件名替換為 `@spekjs/core`，寫入 delta 的 `## MODIFIED Requirements`。

**驗證**：delta 中每個 requirement 的標題須與原 spec 逐字相符（OpenSpec 以標題比對，whitespace-insensitive）；且 delta 內容與原文的差異**只能是套件名**——可用 `diff` 逐一驗證，任何額外差異都是抄錯。

`core-module` 另需一條 `## ADDED Requirements`：該套件須發佈至 npm public registry，且可被本 monorepo 以外的 repo 安裝。

`@spek/web` 在 `openspec/specs` 中零引用，其改名**不產生任何 delta**。

### D4：三類路徑，三種處置

改名必須先分清楚「誰該被手動改」。錯把產物或歷史當成原始碼改，是本 change 最容易犯的錯。

**(a) 手動改**

- `packages/core/package.json`（`name`）、`packages/web/package.json`（`name` + `dependencies`）、`packages/vscode/package.json`（`dependencies`）
- `packages/{core,web,vscode,intellij}` 的原始碼與設定
- root `package.json` 的 scripts（`-w @spek/core`、`-w @spek/web`）
- `.github/workflows`（2 支）、`action.yml`
- `README.md`、`README.zh-TW.md`、`CLAUDE.md`

**(b) 重新產生，不手動改**

- `package-lock.json` — `npm install` 後自動更新
- `docs/demo.html` — `npm run build:demo` 重新產生。**注意它重新產生後仍會含有舊套件名**（實測 `@spek/core` 198 處、`@spek/web` 30 處），因為它把 spek 自身的 openspec 內容內嵌進 HTML，而 archived change 的原文永遠記載當時的名稱。「demo.html 不得殘留舊名」是個做不到、也不該做到的要求。
- `openspec/specs/**` 的 **requirement 區塊** — `openspec archive` 套用 delta 時自動更新

> **例外：`openspec/specs/**` 的非 requirement 區塊需手動同步。** delta 只能表達 requirement 的變更，`archive` 不會碰 `## Purpose`。實測有 3 處落在該區塊：`core-module`、`dev-environment-setup`、`vscode-extension-host` 的 `## Purpose` 各 1 處。這 3 處必須在實作階段手動改，否則主 spec 會在 archive 後留下舊套件名。`vscode-extension-host` 也正因如此不需要 delta —— 它的引用**只**出現在 Purpose。

**(c) 歷史記錄，絕不改**

- `openspec/changes/**`（`@spek/core` 68 檔、`@spek/web` 13 檔，含 `archive/`）
- 三份 `CHANGELOG.md` 的**既有條目**。裡面的 `Add extractHeadings and slugifyHeading utilities to @spek/core`、`npm test -w @spek/web` 描述的是當時已發佈版本的事實；改掉會讓那些陳述變成假話。
- `docs/change-lifecycle-roadmap.md` — 標有「產出日期：2026-04-25」的規劃快照。

**替換樣式**：`@spek/core` 與 `@spek/web` 分別精確匹配，不可用會互相誤傷的樣式（`@spek/` 前綴替換會同時打到兩者，且會打到歷史檔）。

**改名後的驗證（每一條都要跑）**

1. `git diff --stat openspec/changes` 為空，`git diff --stat CHANGELOG.md packages/*/CHANGELOG.md` 為空，`git diff --stat docs/change-lifecycle-roadmap.md` 為空 —— 歷史未被污染。
2. 排除 `openspec/changes`、`node_modules`、`dist`、上述歷史檔後，全 repo `@spek/core` 與 `@spek/web` 殘留數皆為 0。
3. `npm run type-check`、`npm run test -w @spekjs/core` 通過。
4. web / vscode / intellij / demo 四種產物的 build 全部通過（`build:demo` 會順帶更新 `docs/demo.html`）。

### D5：發佈周邊與流程

**npm tarball 只含 package 目錄**，root 的 `LICENSE` 不會被自動帶上。`packages/core` 目前既無 `LICENSE` 也無 `README`。

- 複製 root 的 MIT `LICENSE` 至 `packages/core/LICENSE`。
- 新增 `packages/core/README.md`（npm 套件頁面的內容）。
- `package.json` 補 `repository: { type, url, directory: "packages/core" }`（monorepo 應指出子目錄）。
- `files: ["dist", "CHANGELOG.md"]` —— npm 會自動額外包含 `package.json`、`README`、`LICENSE`，但**不會**自動包含 `CHANGELOG.md`（見 D7）。
- `publishConfig: { access: "public" }` —— scoped package 預設是 `restricted`，不設會發成私有套件而失敗。

**`dist` 被 `.gitignore` 排除**（`.gitignore:5`），但 `prepare: tsc` 會在 `npm publish` 前自動執行並產生它（npm 10.9.4）。發佈前仍須以 `npm pack --dry-run` 檢視 tarball，確認 `dist/*.js` 與 `dist/*.d.ts` 在內、`src/` 不在內。

**發佈方式**：本機 `npm publish -w @spekjs/core`。CI 自動發佈與 provenance 屬 Non-Goal。

> **發佈前提（實測修正，2026-07-09）**：原先依 `npm profile get` 顯示的 `two-factor auth: disabled` 判斷「不需 OTP」，**這個推論是錯的**。以 `~/.npmrc` 中既有的 classic auth token 執行 `npm publish` 會被 registry 以 **403** 拒絕：
>
> ```
> Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.
> ```
>
> npm 現行政策要求 publish 必須通過 2FA，或使用具備 bypass 權限的 granular access token；帳號層級的 2FA 開關與此無關。該次 403 發生在 tarball 上傳階段，**版本號未被消耗**，`1.0.0` 仍可用。
>
> 發佈前必須先滿足下列其一：
>
> 1. **啟用帳號 2FA**（`npm profile enable-2fa auth-and-writes`，需 authenticator app），發佈時附上 `--otp=<code>`。最快，但每次發版都要輸入驗證碼。
> 2. **建立 Granular Access Token**（npmjs.com → Access Tokens → Granular），授予 `@spekjs/*` 的 read/write 權限並啟用 *Bypass 2FA*，寫入 `~/.npmrc`。較適合自動化與日後的 CI 發佈。
>
> `npm token list` 在目前的 classic token 下回傳空值，可用來佐證認證方式尚未升級。

### D6：內部依賴維持 workspace 解析

`packages/web` 與 `packages/vscode` 的依賴宣告由 `"@spek/core": "*"` 改為 `"@spekjs/core": "*"`。`*` 由 npm workspaces 解析到本地 package，**不會**去 registry 抓 —— repo 內的開發因此不受 core 發版節奏拖累。只有外部消費者（`spek-workspace`）使用語意化版本範圍。

`@spekjs/web` 維持 `private: true`，不發佈；改名純為 monorepo 內的命名一致。

### D7：core 另立 `packages/core/CHANGELOG.md`，三份既有 CHANGELOG 不動

**現行三份 CHANGELOG 服務的是「spek 這個產品」的三個發行通道**（Web / VS Code Marketplace / JetBrains Marketplace），共用 root 的版本線（`1.5.0`），讀者是終端使用者。實測顯示它們並非逐字一致，而是共享同一份歷史、各自過濾掉不相關通道的條目。

**core 發到 npm 後是第四個發行通道，但版本線獨立**（`1.0.0`），讀者是**開發者** —— 他們關心 `scanOpenSpec` 的簽章變更，不關心 timeline 的空狀態文案；反之亦然。把兩者混在同一份檔案，會讓 `## 1.5.0` 與 `## 1.0.0` 兩條版本線並存，必然混淆。

**決定**

- 新增 `packages/core/CHANGELOG.md`，只記 core 的版本線，首篇為 `## 1.0.0`（首次發佈：更名、依賴精簡、發佈至 npm）。
- 因 npm 不自動打包 `CHANGELOG.md`，須列入 `files`（見 D5）。
- **三份既有 CHANGELOG 本次不新增任何條目**：本 change 不發佈 spek 產品的新版本，且 core 更名對 Web / VS Code / IntelliJ 的終端使用者無可觀察的影響。待日後 spek 發新版時，若有面向使用者的變更再一併記錄。
- **更新 `CLAUDE.md` 的 Conventions**，把「三份內容必須一致」改寫為精確描述（共享版本歷史 + 過濾通道條目），並載明 `packages/core` 有獨立版本線與獨立 CHANGELOG。

**替代方案與否決理由**

| 方案 | 否決理由 |
|---|---|
| core 的變更記進三份 CHANGELOG | 兩條版本線（`1.5.0` / `1.0.0`）並存於同一檔案；且 API 變更對終端使用者無意義。 |
| core 版本綁定 root（也發 `1.5.0`） | spek 發版時 core 未必有變更，反之亦然。強行綁定會製造無內容的空版本。 |
| 不為 core 寫 CHANGELOG | npm 頁面的消費者無從得知 API 變更歷史，與「成為生態解析引擎」的定位相悖。 |

## Risks / Trade-offs

- **MODIFIED delta 漏抄 scenario，archive 時靜默抹掉主 spec 的內容** → D3 以腳本生成，並用 `diff` 驗證「與原文的差異僅有套件名」。這是本 change 最容易造成無聲損害的地方。
- **誤改歷史記錄**（`openspec/changes/`、CHANGELOG 既有條目、roadmap 快照） → D4 的三類分流 + 改名後以 `git diff --stat` 逐一驗證這些路徑為空。
- **替換樣式互相誤傷** → `@spek/core` 與 `@spek/web` 分別精確匹配；嚴禁對 `@spek/` 前綴做通用替換。
- **手動改到建置產物**（`docs/demo.html`、`package-lock.json`、`openspec/specs/`） → 一律以重新產生的方式更新；`build:demo` 與 `openspec archive` 各自負責。
- **移除 `fuse.js` / `gray-matter` 後出現隱藏使用者** → 已掃描 `src` 與 `dist`，兩者皆零 import；`type-check` 與四種產物 build 作為回歸網。
- **首次即發 `1.0.0`，日後想改 API 會受 semver 約束** → API 已被四個內部消費者驗證；真要 breaking 就發 `2.0.0`，這正是 semver 的用途。
- **`dist` 被 gitignore，發佈時忘記 build** → `prepare: tsc` 於 publish 前自動執行；`npm pack --dry-run` 為最後檢查。
- **`CHANGELOG.md` 未被打包進 tarball** → 明確列入 `files`；以 `npm pack --dry-run` 確認它在內。
- **發佈不可逆** → npm `unpublish` 僅限 72 小時內，且會留下無法重用的墓碑版本號。`npm pack --dry-run` 是唯一的最後關卡（見 Migration Plan）。

## Migration Plan

1. **清理 core 依賴**（D2）：`dependencies` 縮為 `{ cross-spawn }`。跑 `npm run test -w @spek/core` 與四種產物 build，確認無回歸。此步先做，讓後續改名的 diff 單純。
2. **改名並更新引用**（D4 的三類分流）：手動改 (a) 類；不碰 (b)(c) 類。
3. **產生 10 個 MODIFIED delta**（D3），並以 `diff` 驗證與原文僅差套件名。
4. **補齊發佈周邊**（D5、D7）：`LICENSE`、`README`、`CHANGELOG`、`repository.directory`、`files`、`publishConfig`、`private: false`、版本 `1.0.0`。
5. **重新產生建置產物**：`npm install`（更新 lockfile）、`npm run build:demo`（更新 `docs/demo.html`）。
6. **`npm pack --dry-run`** 檢視 tarball 內容（`dist`、型別檔、`README`、`LICENSE`、`CHANGELOG` 在內；`src` 不在內）。**此步之後即為不可逆點。**
7. **`npm publish -w @spekjs/core`**。
8. **驗證發佈**：`npm view @spekjs/core version`；在乾淨目錄 `npm install @spekjs/core` 並實際 `import { scanOpenSpec }` 呼叫一次。
9. **更新 `CLAUDE.md`** 的 CHANGELOG 慣例描述（D7）。

**Rollback**：步驟 1–5 皆可 `git revert`，因為 repo 改動與 npm 發佈是兩件獨立的事。步驟 7 之後無法真正撤回 —— `npm unpublish` 只在 72 小時內可用，且該版本號永久不可重用。因此步驟 6 的 tarball 檢查是唯一的把關點。

## Open Questions

- **core 是否要宣告 `engines.node`？** 目前未宣告。dist 為 ESM 且使用 `node:` 內建模組，實際下限值需確認。
- **是否並行向 npm 申請 `@spek` 的 name dispute？** 佔用者 0 套件、符合閒置條件。取回後可考慮 alias，但不應阻塞任何工作。
- **`@spekjs/web` 日後若要發佈，是否需要重新檢視其依賴足跡？** 目前 `private: true`，不在本 change 範圍。
