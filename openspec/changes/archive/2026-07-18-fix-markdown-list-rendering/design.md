## Context

`MarkdownRenderer.tsx` 以 utility class 直接寫在 component override 上，無任何外部 CSS —— `.markdown-body` 這個 wrapper class（`:115`）**全 repo 沒有任何規則掛載**，是個死 hook。本 change 的兩個缺陷都源自 override 本身：

1. `ul`/`ol` 寫死 `list-inside`（`:230`、`:233`），marker 進入內容流；loose list 的 `<p>`（block）把 marker 擠到自己一行。
2. `ul`/`li` override 只解構 `{ children }`，`className` 被丟棄 —— remark-gfm 的 `contains-task-list` / `task-list-item` 從未進 DOM。

兩者已用 `react-dom/server` 渲染真實 component + 瀏覽器截圖確認（含 loose / tight / 純項目符號對照組）。純呈現層問題，不涉及 core、API 或 adapter。

## Goals / Non-Goals

**Goals:**
- 任何 list（loose 或 tight、有無 checkbox）的 marker 與內容首行同行。
- task list item 只顯示 checkbox，不顯示 marker；一般 list 保留 marker。
- 續行（wrapped text）以 hanging indent 對齊首行文字，checkbox 與一般 marker 行為一致。
- 保留 `contains-task-list` / `task-list-item`，讓此區分未來可用 CSS 表達。

**Non-Goals:**
- 非 GFM 的 `[~]` deferred 狀態（janitarr 使用）。GFM 不解析為 task item，需自訂 remark plugin，屬另一個 change。本 change 只保證它退化成一般 list item。
- 重新設計 markdown 的整體排版（間距、字級、顏色）。這是 bug fix，不是 restyle。
- `.markdown-body` 的其他用途。

## Decisions

### D1: `list-outside` + 左內距，取代 `list-inside`

`ul` → `list-disc list-outside pl-6`，`ol` → `list-decimal list-outside pl-6`。marker 移出內容盒後，即使項目內容是 block `<p>`，marker 仍與首行同列；續行自然形成 hanging indent。

**替代方案（已否決）**：保留 `list-inside` 而把 li 內的 `<p>` 改成 `display: inline`。會破壞同一項目內多段落與內嵌 blockquote 的排版（janitarr retrospective §6 正是此形狀），且 `<p>` 的語意被 CSS 掏空。

### D2: task list 用「gutter pull」抑制 marker，而非歸零內距

task list：**逐項**（`li.task-list-item`）加 `list-none`，容器**維持** `list-disc` / `list-decimal` 並**保留與一般 list 相同的 `pl-6`**；checkbox 以負左邊距（`-ml-6`）拉進 marker 溝槽，`mr-2` 之後文字正好落在內容邊緣。此為 GitHub 自身 `.task-list-item { list-style: none }` + `.task-list-item input { margin-left: -1.4em }` 的作法。

> **marker 的取消必須掛在項目（li），不能掛在容器（ul/ol）。** 本 change 的第一版把 `list-none`
> 掛在 `ul` 上、以 `contains-task-list` 判定 —— 這是錯的，且對抗性審查抓到兩個真實 bug：
> remark-gfm 只要 list 內**有任一** task item 就會在容器掛上 `contains-task-list`，但
> `task-list-item` 是**逐項**的。於是
> 1. **混合清單**（task + 一般項目並存，GFM 合法）的一般項目**連 marker 都沒有**，變成裸文字；
> 2. **有序 task list**（`1. [ ]`，remark-gfm 同樣掛 `contains-task-list`）的 `ol` 因為當時
>    只有 `ul` 分支而保留 `list-decimal`，數字與被 `-ml-6` 拉進同溝槽的 checkbox **重疊**，
>    渲染成 `☐. alpha`（數字被蓋掉）。
>
> 掛在 li 上同時修好兩者，並讓容器端的 `contains-task-list` 字串偵測**整個消失**。
> GitHub 把規則寫在 `.task-list-item` 上正是這個原因。

**替代方案（已否決，皆經實測截圖驗證）**：
- **`list-none` + `pl-0`**：checkbox 貼齊左緣，但**續行會捲回 checkbox 底下**，長 task（janitarr `tasks.md` 有 8 行的項目）讀起來像散文而非清單。第一版候選就是敗在這裡。
- **`li` 上加 `flex items-start`**：對 tight list 可行，但**loose list 會壞** —— checkbox 位於 `<p>` **之內**，`<p>` 與其後的 `<blockquote>` 會成為並排的 flex item，blockquote 被推到文字右側。retrospective §6 每一項都是這個形狀。

### D3: 條件式 className 留在 JSX，不新增 CSS 檔

override 現已向下傳遞 `className`，故可直接在 `li` 偵測 `task-list-item` 並附加 `list-none`。維持與本 component 既有風格一致（全 utility、零外部 CSS），也不必喚醒 `.markdown-body` 這個死 hook。

**替代方案（未採用）**：在 `global.css` 用 `.markdown-body .task-list-item { list-style: none }`。此方案本身正確（且會讓那個死 hook 有用途），與 D2 修正後的行為等價；不採用純粹因為它把樣式散落到 component 之外，而 `className` 無論如何都得先傳下去 —— li 的 class 轉發是兩案共同的前提。

**關於 `className` 而非 `node`**：react-markdown 10.1.0 的 `Components` 型別是 `JSX.IntrinsicElements[K] & ExtraProps`，其中 `node?: Element | undefined` 是 **optional**，而 `className` 是正式且穩定的 prop。實測 `li` 收到的 props 僅 `className` / `node` / `children`（**沒有** `checked`）。以 optional 的 `node` 換取 array-based 的精確 token 比對不划算，維持 `className`。

### D4: 只收斂 li 內**尾段**的底距（`:last-of-type`）

`p` override 的 `mb-4` 在 list item 內會在項目**尾端**多出一段空隙，把單一項目撐成數段（文字與其內嵌 blockquote 之間尤其明顯）。以 arbitrary variant `[&_li>p:last-of-type]:mb-0` 限定在 list 內歸零，不動 list 外的段落間距。

> **不可歸零項目內的全部段落。** 第一版用的是 `[&_li>p]:mb-0`（無 `:last-of-type`），
> 對抗性審查實測：同一項目內若有多個段落，段間間距被壓成 **0px**，比**項目之間**的 4px 還小，
> 兩段直接黏成一塊（修正前是 16px）。`:last-of-type` 讓段間回到 16px、尾段仍為 0px，
> 原本的 loose list 缺陷維持修好。
>
> **且不可用 `:last-child`** —— `processChildren` 會把空白文字節點包成 `<span>`，
> li 的子節點實際是 `SPAN,P,SPAN,P,SPAN`，**沒有任何 `p` 會是 `:last-child`**（實測
> `lastChildMatch: false` / `lastOfTypeMatch: true`）。`:only-of-type` 對多段項目同樣失效。

## Risks / Trade-offs

- **全 app 的 list 縮排位移** → 這是 `list-inside` → `list-outside` 的必然後果，也是本 change 唯一的非局部視覺影響。已明確與提案者確認接受。屬修正而非 restyle：現況的斷行本身就是 bug。
- **`input` override 的 `-ml-6` 是為 task list 量身訂做** → remark-gfm 只在 task list item 內產生 `input[type=checkbox]`，故實務上安全；但若未來有 list 外的 checkbox（例如原始 HTML），負邊距會誤拉。可接受，必要時再以 `task-list-item` 範圍限定。
- **`pl-6` / `-ml-6` 必須成對** → 兩者相依（溝槽寬度 = 負邊距）。改其一必須同步改另一，否則 checkbox 會浮出或壓字。實作時以註解標明相依。
- **demo 需 rebuild** → `docs/demo.html` 是建置產出，不 rebuild 不會反映修正。不在本 change 的驗收範圍（依慣例 bundle 產出留給整合階段）。

## Migration Plan

無資料或 API 變更，無需 migration。回滾即還原 override 的 class 字串。

## Verification limits（重要，勿當成已自動化）

**單元測試守不住幾何。** `renderToStaticMarkup` 回傳字串，沒有 CSSOM 也沒有版面計算，故
`MarkdownRenderer.test.ts` 只能守住**結構與 class 的作用域**。已實測的反例：替 checkbox 加上
`block` 會**重現原始 bug**（marker 與內容分行），而測試**全綠**。class 斷言只驗「token 在不在」，
不驗「有沒有別的宣告蓋掉它」。

幸運的是本 change 修掉的三個 bug **全部是作用域錯誤**（marker 取消掛錯層級、mb-0 範圍過寬），
那正是 class 斷言驗得到的部分 —— 已逐一以 mutation 確認測試會紅。

spec 中四條以視覺結果表述的情境（marker 同行、續行對齊、checkbox 對齊首行、內嵌 blockquote）
**由瀏覽器實測驗證，非自動化**。作法與數值見 tasks.md 5.3。若要納入 CI，需引入版面 oracle
（Playwright），屬另一個 change。

## Open Questions

無。作法已以真實 component 渲染 + **瀏覽器實測量測**驗證（見 tasks.md 5.3 的數值）。
