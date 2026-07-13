## Why

GitHub org **`spekhq`** 已建立，私有的 Electron 工作台 `spekterm` 已 transfer 進去（`spekhq/spekterm`）。`spek` 仍留在個人帳號 `kewang/spek`，與 org 的歸屬不一致。

原本首選的 org 名 `spekjs`（與 npm scope `@spekjs` 對齊）**開不出來** —— 它被一個 0 repo、0 follower 的閒置 User 帳號佔著（GitHub 的 username 與 org 共用同一個命名空間），而 GitHub **不因閒置釋出名字**，只受理商標爭議。申訴已放棄，改採 `spekhq`。

**搬遷成本單調上升，而今天是最低點：**

- 實測 GitHub code search，公開程式碼中 `uses: kewang/spek@` 的**外部使用者為 0**（15 個命中全在本 repo 內；對照組 `actions/checkout@v7` 有命中，證明搜尋確實在運作）。
- action 掛在 Marketplace 上越久，被採用的機率越高；指向 `kewang.github.io/spek` 的外部連結也只會累積。**兩者都只漲不跌。**

## What Changes

有兩個東西 GitHub **不 redirect** —— 它們是這個 change 的全部風險，其餘一切（git 操作、網頁連結、issues、releases、forks、secrets、webhooks、deploy keys）都會自動跟著搬或 redirect。

**1. Action 的 `uses:` 參照不 redirect。** 這是 GitHub 刻意的安全設計（不讓改名劫持他人的 action）：舊參照直接以 `repository not found` **硬失敗**，不是降級。而且是**兩層**都綁死舊位置：

- 消費者 workflow 裡的 `uses: kewang/spek@v1`
- `action.yml` 內 composite action 在**執行期**用 `actions/checkout` 拉自己的原始碼（`repository: kewang/spek`）

**2. GitHub Pages 不 redirect**（GitHub 文件明文：git 與網頁連結會 redirect，Pages 不會）。`kewang.github.io/spek` 上的 README 頂部 3 個 badge 與 **Live Demo** 會 404。

因此本 change：

- 將 repo transfer 為 **`spekhq/spek`**，並更新本機 `git remote`。
- `action.yml` 的 `repository:` 改指新位置；**`v1` tag 重新指向新位置的 release commit**（**不發 v2**）—— 外部使用者為 0，v2「來源 repo 換了」的語意誠實換不到它強迫所有人改寫 `uses:` 的成本。
- 所有 Pages URL（3 個 badge、Live Demo）改為 `spekhq.github.io/spek`，並重新 deploy Pages。
- npm、VS Code Marketplace、JetBrains Marketplace 的 listing 連結與 badge，**必須各自發一次新版才會更新** —— listing 是 README 的**發佈快照**，改了 repo 裡的 README 不會回頭修正已發佈的頁面（否則那些商店頁上的 badge 會一直是破圖）。

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `github-action`：action 的來源 repo 與所有 `uses:` 參照從 `kewang/spek` 改為 `spekhq/spek`。

> `intellij-marketplace-metadata` 與 `vscode-marketplace-metadata` **不需要 delta** —— 它們的 requirement 是泛稱（「vendor url 指向 GitHub repository」「package.json 包含 `repository` 欄位」），沒有寫死 owner。改的是實作值，不是 requirement 的行為。

## Impact

| 類別 | 檔案 |
|---|---|
| Pages URL（badge ×3、Live Demo） | `README.md`、`README.zh-TW.md` |
| Action 位置 | `action.yml`（`repository:`）、兩份 README 的 `uses:` ×3、`.agents/skills/release/SKILL.md` |
| npm metadata | `packages/{core,ui,vscode}/package.json` 的 `homepage` / `bugs` / `repository` |
| 套件 README | `packages/{core,ui,vscode}/README.md` |
| IntelliJ | `packages/intellij/build.gradle.kts`、`META-INF/plugin.xml` 的 `<vendor url>` |
| 本機設定 | `.claude/settings.local.json` 的 `WebFetch(domain:kewang.github.io)` |
| 陳舊參照 | `CLAUDE.md` 第 16 行對宿主的指涉 —— **移除**，不改名 |

> `CLAUDE.md` 唯一一處提到 spekterm 的地方（`@spekjs/ui`「供 repo 外的宿主（`spek-workspace`，Electron
> agent 工作台）使用」）**整段拿掉**，而非把舊名換成新名：spek 是 MIT 公開 repo，它的文件不該指名一個
> 私有的商業產品。句子退為「供 repo 外的宿主使用」，語意完整，且從此不會再隨那個產品改名而過期。

**跨 repo（不在本 change 內，由 `spekterm` 自己承擔）**：`spekterm` 的 `CLAUDE.md`、`README.md`、`docs/PRD.md` 共 4 個指向 `github.com/kewang/spek` 的連結，以及它 `CLAUDE.md` 中「spek 刻意留在 `kewang/spek`」那一整段論證，都要隨本 change 落地後改寫。OpenSpec change 是 repo-local 的。

## Non-Goals

- **npm scope 維持 `@spekjs`，不改為 `@spekhq`。** 套件已發佈、那個 npm org 真的叫 `spekjs`。GitHub org 名與 npm scope 不一致是常態（`@tailwindcss/*` 的源碼在 `tailwindlabs/tailwindcss`），為了對齊而重發一次 scope，成本遠大於收益。
- **VS Code / JetBrains 的 publisher ID 不改** —— 那是各商店自己的帳號體系，與 GitHub org 無關。
- **`CHANGELOG.md` 與 `openspec/changes/archive/**` 不改** —— 歷史紀錄，記載的是當時的事實。
- **不購買自訂網域。** 它能讓 Pages URL 從此與 owner 脫鉤（掛上網域後 `<owner>.github.io/<repo>` 會自動 redirect 到該網域），但那是另一個決策，不阻塞本 change。

## Risks / Trade-offs

- **私有 repo 的 action 使用者看不到。** code search 只涵蓋公開 repo 的預設分支。若真有私有使用者，他們的 CI 會在下次跑時硬失敗。以 32 stars 的規模與 0 個公開使用者估計，風險可接受 —— 但這是一個**無法完全驗證**的假設。
- **指向 `kewang.github.io/spek/demo.html` 的外部連結永久失效**（HN、部落格、商店頁的快取描述）。無法以任何 redirect 補救 —— 這正是「越早搬越便宜」的來源。
- **已發佈版本的 npm metadata 不可變。** `@spekjs/core@1.x` 等既有版本的 `repository` 欄位會永遠指向 `kewang/spek`（靠 GitHub 的 repo redirect 接住，不會斷）。只有新版才帶新位置。
