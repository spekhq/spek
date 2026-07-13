## Context

`kewang/spek` → `spekhq/spek`。技術上這是一次 GitHub repo transfer，絕大部分東西（git 操作、網頁連結、issues、releases、forks、secrets、webhooks、deploy keys）都自動 redirect 或跟著搬。

真正需要設計的，是 GitHub **不 redirect** 的那兩樣東西 —— action 的 `uses:` 參照，以及 GitHub Pages —— 以及一個**不會壞、但會靜默留下供應鏈隱患**的第三樣（D2）。

## Decisions

### D1 — `v1` 重新指向新位置，**不發 v2**

**決策**：transfer 後把 `v1` tag force-update 到新位置的 release commit，沿用既有 spec 的「Major version tag」機制（release skill 本來就會 force-update `v1`）。不開 `v2`。

**關鍵在於：發 v2 救不了任何人。** 直覺會以為「v1 留給舊使用者、v2 給新位置」是負責任的做法 —— 但那個直覺預設了舊參照還活著。它沒有：`uses:` **完全不 redirect**，所以 transfer 之後 `kewang/spek@v1` 與 `kewang/spek@v2` **一樣都是 `repository not found`**。「保護既有使用者」不是 v2 能提供的東西，那條路根本不存在。

既然兩個選項對舊使用者的結果完全相同，就只剩成本比較：v2 的唯一收益是語意誠實（「來源 repo 換了，所以換個 major」），代價是**強迫每個人改寫 `uses:` 那一行**。而外部使用者實測為 0 —— 這個收益的受眾是空集合，代價卻是實的。

**此決策有前提**：它建立在「外部使用者為 0」上。若日後發現有私有 repo 的使用者，他們無論如何都已經斷了（見 Risks），v2 也不會讓他們少斷一次。

### D2 — `action.yml` 的 `repository:` 是**第二層**，而它不會壞 —— 這才是危險的地方

composite action 在**執行期**用 `actions/checkout` 拉自己的原始碼：

```yaml
- name: Checkout spek
  uses: actions/checkout@v7
  with:
    repository: kewang/spek        # ← 第二層
    ref: ${{ inputs.spek-version }}
```

消費者的 `uses:` 是第一層，這一行是第二層。**如果只改第一層而漏了這一行，action 不會壞** —— `actions/checkout` 走的是 git，而 git **是** redirect 的，它會靜默地成功。

**「不會壞」在這裡不是好消息，是最壞的一種結果**：它讓一個錯誤通不過任何測試，然後把整個 action 的原始碼來源**永久寄生在 GitHub 的 redirect 上**。而 redirect 是 GitHub 的善意，不是契約 —— 它在一種情況下會直接消失：**舊名被重新佔用**。任何人（包括作者自己）在 `kewang/` 底下再建一個叫 `spek` 的 repo，redirect 立刻停用，於是這個 action 會在**沒有任何人改動過它**的情況下，開始 checkout 一個完全不同的 repo，並在使用者的 CI 裡執行它。

那是一條供應鏈路徑。**因此這一行必須改，而且必須有一條專門的驗收去證明它改了** —— 它是本 change 中唯一「漏掉也全綠」的項目。

### D3 — Pages：接受斷裂，**不做 shim repo**

**考慮過的替代方案**：transfer 之後，在 `kewang/` 底下重新建一個叫 `spek` 的 stub repo，用它的 GitHub Pages 把 `kewang.github.io/spek/*` 轉址到新位置，藉此救回 badge 與 Live Demo。

**否決，而且理由是決定性的：重新佔用舊名會停用 GitHub 的 repo redirect。** 於是：

- `git clone https://github.com/kewang/spek` 不再 redirect 到新家，而是 clone 到那個 stub。
- 既有 clone 的 `git fetch` 會拉到一個歷史完全不同的 repo。

**用一個會靜默給出錯誤內容的機制，去救幾張 404 的圖片，是壞交易。** 何況它連救都救不完整：badge 是 `<img>` 載入的 SVG，而 GitHub Pages 的轉址手段（meta-refresh）**對圖片無效** —— shim 只救得了 `demo.html`，救不了 badge。收益比想像中更小，代價卻是把 git 這條最要緊的路徑換成一個會騙人的東西。

**決策**：接受 Pages 斷裂。我們自己的 README 全部改指 `spekhq.github.io/spek`，Pages 在新位置重新 deploy。外部深連結永久失效，列為已知代價（這正是「越早搬越便宜」的來源）。

### D4 — 商店的破圖要靠「重新發佈」修復，而發佈路徑**有兩條，不是一條**

npm、VS Code Marketplace、JetBrains Marketplace 的頁面，都是**發佈當下 README 的快照**。改了 repo 裡的 README，**不會**回頭修正已發佈的 listing —— 那些頁面上的 badge 會一直是破圖，直到各自發一個新版。

**而發佈路徑有兩條，這是最容易漏的地方**（實地查證 `.agents/skills/release/SKILL.md` 與 `.github/workflows/` 得出）：

| 路徑 | 涵蓋 | 誰觸發 |
|---|---|---|
| **release skill**（推 tag → CI） | VS Code Marketplace、JetBrains Marketplace、GitHub Release／Actions Marketplace、**`v1` tag 的 force-update** | `.agents/skills/release/SKILL.md` |
| **手動 `npm publish`** | `@spekjs/core`、`@spekjs/ui` | 無 workflow、無 skill |

`@spekjs/core` 與 `@spekjs/ui` **有獨立於 root 的版本線**（CLAUDE.md 明載），既不隨 root 的 `version` script 連動，也沒有任何 CI 在發它們。**只跑 release skill，npm 上的那兩個頁面會一直是破圖。**

**決策**：收尾是**兩個動作**，缺一不可 ——

1. 跑 release skill（一石二鳥：VS Code／JetBrains／GitHub Marketplace 的 listing 更新 + `v1` 重新指向新位置）。
2. 手動 `npm publish` 一次 `@spekjs/core` 與 `@spekjs/ui` 的 patch 版。

不另外手動 push `v1` tag —— 那是 release skill 的職責，重複做只會兩邊分叉。

### D5 — 執行順序：**先 transfer，再改檔，最後發 release**

兩種順序都有中間窗口，選傷害小的那個。

- **先改檔再 transfer** —— 文件會有一段時間指向一個**還不存在**的 `spekhq/spek`；更糟的是改完 `docs/` 就會觸發 `Deploy Pages`，把一版寫著 `spekhq.github.io` 的 badge URL 部署到**還在 `kewang` 底下**的 Pages 上，當場自我打臉（全部 404）。
- **先 transfer 再改檔** —— 中間狀態的文件寫著舊位置，但 git 與網頁連結都有 redirect 撐著；只有 badge 與 demo 破圖，窗口是幾分鐘。

**決策**：先 transfer。

**而且 action 在這個窗口內不會有斷點**：transfer 之後 `v1` tag 跟著搬，`uses: spekhq/spek@v1` 立刻可用；該 tag 上的 `action.yml` 雖然還寫著 `repository: kewang/spek`，但那一層走 git、會 redirect（D2）。所以 action 的功能全程不中斷 —— 斷的只有還在用舊路徑 `uses: kewang/spek@v1` 的人（實測為 0）。

## Risks / Trade-offs

- **私有 repo 的 action 使用者無法驗證。** GitHub code search 只涵蓋公開 repo 的預設分支。若真有這樣的使用者，他們的 CI 會在下次跑時以 `repository not found` 硬失敗，且我們無從事先通知。以 32 stars、0 個公開使用者估計，接受此風險 —— 但它是**無法完全驗證**的假設，不是已證實的事實。
- **`kewang.github.io/spek/demo.html` 的外部深連結永久失效**，無任何 redirect 可補救（D3 已論證 shim 不可行）。
- **已發佈版本的 npm metadata 不可變**：`@spekjs/core@1.x` 等既有版本的 `repository` 會永遠指向 `kewang/spek`，靠 GitHub 的 repo redirect 接住（不會斷，但依賴 redirect —— 與 D2 同一種依賴，差別在這裡我們無法修正已發佈的 tarball，只能接受）。
- **`kewang/spek` 這個名字此後不可再被佔用。** D2 與上一條都建立在 repo redirect 存活上。**在 `kewang/` 底下重建同名 repo 會同時炸掉這兩者** —— 這個約束必須寫進 spek 的 CLAUDE.md，否則它只存在於這份 design 裡，遲早被遺忘。

## Open Questions

- **Pages 在 org 下是否需要重新啟用？** repo 設定應隨 transfer 走，但 org 層的 Actions／Pages 權限預設可能不同。落地時必須實測：`Deploy Pages` workflow 跑得起來、且 `https://spekhq.github.io/spek/` 回 200。列為 tasks 的驗收項，不是決策。
- **GitHub Marketplace 的 action listing 是否跟著 transfer？** 目前 `github.com/marketplace/actions/spek-openspec-static-site` 回 200。transfer 後必須複驗；若 listing 掉了，需從新位置重新上架。
