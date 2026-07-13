# Tasks

> 順序依 design D5：**先 transfer → 再改檔 → 最後發佈**。反過來的話，改 `docs/` 會觸發
> `Deploy Pages`，把寫著 `spekhq.github.io` 的 badge URL 部署到還在 `kewang` 底下的 Pages 上，
> 當場全部 404。

## 1. Transfer

- [x] 1.1 `gh api -X POST /repos/kewang/spek/transfer -f new_owner=spekhq`。transfer 是**非同步**的
      （API 回 202、`full_name` 仍是舊值），必須輪詢 `gh api /repos/spekhq/spek` 直到落地，不能看
      回傳值就當作成功
- [x] 1.2 本機 `/home/kewang/git/spek` 的 `git remote set-url origin`，並以 `git fetch` 實測
      （`fork` remote 指向 `nthansen/spek`，不動）
- [x] 1.3 確認舊網址 redirect 生效：`gh api /repos/kewang/spek` 應回 `spekhq/spek`

## 2. Open Questions 的實測（design 列為待驗，落地時才有答案）

- [x] 2.1 **Pages 是否仍啟用**：`gh api /repos/spekhq/spek/pages`。org 層的 Actions／Pages 權限
      預設可能與個人帳號不同 —— 若被關掉，在 org 設定中重新啟用
- [x] 2.2 **GitHub Marketplace 的 action listing 是否跟著 transfer**：複驗
      `github.com/marketplace/actions/spek-openspec-static-site`（transfer 前為 200）。若掉了，
      需從新位置重新上架

## 3. Action 的兩層（design D2 —— 本 change 唯一「漏掉也全綠」的項目）

- [x] 3.1 `action.yml` 的 `repository: kewang/spek` → `spekhq/spek`（**第二層**：composite action
      執行期 checkout 自己的原始碼。漏改**不會壞** —— 它走 git，而 git 會 redirect）
- [x] 3.2 `README.md` 的 `uses: kewang/spek@v1` ×3 → `spekhq/spek@v1`（**第一層**：消費者參照。
      這層不 redirect，漏改就是硬失敗）
- [x] 3.3 `README.zh-TW.md` 的 `uses:` 同上
- [x] 3.4 `.agents/skills/release/SKILL.md` 內文的 `kewang/spek@v1`
- [x] 3.5 以**一次性 grep** 驗收搬遷的完整性，**不加常駐守衛**。
      曾實作 `scripts/check-repo-refs.ts` 並掛進 `npm test`（帶對照組），實測可用：正向通過、
      把 `action.yml:43` 改回舊名會紅、把 pattern 打壞會判定守衛自身失效。**但隨即移除** ——
      它的價值全部集中在這一次搬遷（之後舊名沒有任何「重新流入」的來源），而它的排除清單
      （`CHANGELOG`、整個 `openspec/`、`docs/demo.html`）是永久負債：每多一個合法提到歷史的
      產生物就要再加一條。實作期間它已因 `docs/demo.html` 是 500KB 單行檔而爆過一次 `ENOBUFS`。
      **一次性收益不該用常駐成本去買。** D2 的知識改以 CLAUDE.md 的約束段落承載

## 4. Pages URL（design D3 —— 接受斷裂，改指新位置）

- [x] 4.1 `README.md`：3 個 badge 的 `src`（`badges/specs.svg`、`open_changes.svg`、`tasks.svg`）
      與 Live Demo 連結（`demo.html`）改為 `spekhq.github.io/spek/…`
- [x] 4.2 `README.zh-TW.md`：同上
- [x] 4.3 `README.md` 的 `git clone https://github.com/kewang/spek.git` 改為新位置
      （會 redirect，但文件不該教人用舊網址）

## 5. npm 與商店的 metadata

- [x] 5.1 `packages/core/package.json`、`packages/ui/package.json`、`packages/vscode/package.json`
      的 `homepage` / `bugs` / `repository.url`
- [x] 5.2 `packages/core/README.md`、`packages/ui/README.md`、`packages/vscode/README.md` 的連結
- [x] 5.3 `packages/intellij/build.gradle.kts` 的 `url`，以及
      `packages/intellij/src/main/resources/META-INF/plugin.xml` 的 `<vendor url>`

## 6. 文件

- [x] 6.1 `CLAUDE.md` 第 16 行：**移除**對宿主的指涉（`@spekjs/ui`「供 repo 外的宿主
      （`spek-workspace`，Electron agent 工作台）使用」→「供 repo 外的宿主使用」）。**不是改名** ——
      spek 是 MIT 公開 repo，它的文件不該指名一個私有的商業產品，也不該隨那個產品改名而過期
- [x] 6.2 `CLAUDE.md` 記下約束：**`kewang/spek` 此後不可再被佔用**。repo redirect 是承重的 ——
      已發佈版本的 npm metadata（`repository` 欄位）永遠指向舊位置且**無法修正**，靠 redirect 接住。
      重建同名 repo 會同時炸掉它與 D2 的 `actions/checkout`。這條約束目前只活在 design 裡，不寫進
      CLAUDE.md 就會被遺忘
- [x] 6.3 `.claude/settings.local.json` 的 `WebFetch(domain:kewang.github.io)`（該檔為 gitignored，
      純本機便利）
- [x] 6.4 **CHANGELOG 不在此手寫** —— 那是 release skill 的職責（§8.1）：它自己從
      `openspec/changes/archive/` 抓內容，並同步更新**三份** CHANGELOG（root、vscode、intellij）
      加 `plugin.xml` 的 `<change-notes>`。手寫一份只會與它打架。
      **由此得出一個順序約束**：release skill 讀的是 **archive**，所以本 change 必須**先封存、
      再發版**。§8 的前提是這個 change 已經 archive 掉了

## 7. 驗證

- [x] 7.1 `npm test`、`npm run type-check`、`npm run build`（本 change 未改動任何產品程式碼，
      這三項只是確認 metadata 的編輯沒有弄壞 package.json / gradle / plugin.xml 的可解析性）
- [x] 7.2 重新 deploy Pages（`gh workflow run pages.yml`），實測 `demo.html` 與 3 個 badge 皆回 200。
      **根路徑 `/` 是 404 —— 本來就這樣，不是 regression**：`docs/` 裡沒有 `index.html`，這個站
      一直是走 `/demo.html` 與 `/badges/*` 兩條路徑
- [ ] 7.3 以一個真的 workflow 實測 `uses: spekhq/spek@v1` 跑得起來（action 的**兩層**都要走過 ——
      光看 `action.yml` 的字面改對了，證明不了它 checkout 得到自己）

## 8. 發佈（design D4 —— **兩條路徑，缺一不可**）

- [ ] 8.1 跑 release skill 發一次版：更新 CHANGELOG、bump、推 tag → 觸發 VS Code Marketplace 與
      JetBrains Marketplace 的發佈，建立 GitHub Release（Actions Marketplace），並 force-update
      `v1` tag 指向新位置的 release commit
- [ ] 8.2 **手動** `npm publish` `@spekjs/core` 與 `@spekjs/ui` 的 patch 版 —— 它們有**獨立於 root
      的版本線**，既不隨 root 的 `version` script 連動，也沒有任何 CI 在發它們。**只跑 8.1 的話，
      npm 上那兩個頁面的 badge 會一直是破圖**
- [ ] 8.3 複驗四個商店頁面的 badge 不再破圖：npm（core／ui）、VS Code Marketplace、
      JetBrains Marketplace、GitHub Actions Marketplace
