## 1. Forward the remark-gfm class hooks

- [x] 1.1 在 `packages/web/src/components/MarkdownRenderer.tsx` 的 `ul` override 解構出 `className` 並向下傳遞，讓 remark-gfm 的 `contains-task-list` 抵達 DOM（目前只解構 `{ children }`，class 被丟棄）。
- [x] 1.2 同上處理 `li` override，讓 `task-list-item` 抵達 DOM。
- [x] 1.3 對 `ol` override 做一致處理（GFM 不在 `ol` 產生 task list，但簽章與 `ul` 對齊可避免日後不一致）。

## 2. Fix marker placement (defect 1)

- [x] 2.1 `ul` override：`list-inside` → `list-disc list-outside pl-6`，保留既有的 `mb-4 space-y-1`。
- [x] 2.2 `ol` override：`list-inside` → `list-decimal list-outside pl-6`，保留既有 class。
- [x] 2.3 以 arbitrary variant（如 `[&_li>p]:mb-0`）把 list item 內 `<p>` 的 `mb-4` 歸零，讓單一項目讀起來是一塊；不影響 list 外的段落間距。

## 3. Suppress the task-list marker (defect 2)

- [x] 3.1 ~~`ul` override：當 `className` 含 `contains-task-list` 時附加 `list-none`~~ → **經對抗性審查改為逐項**：`li` override 當 `className` 含 `task-list-item` 時附加 `list-none`；`ul` / `ol` 維持 `list-disc` / `list-decimal` 且**保留 `pl-6`**（溝槽寬度）。容器端的 `contains-task-list` 偵測已移除。見 design D2 的方框說明與下方 §7。
- [x] 3.2 `input` override（checkbox）：加上 `w-4 h-4 -ml-6 mr-2 align-middle`，把 checkbox 拉進 marker 溝槽，使文字與續行皆落在內容邊緣（design D2 的 gutter pull）。
- [x] 3.3 在 `pl-6` 與 `-ml-6` 兩處加繁體中文註解標明兩者相依（溝槽寬度 = 負邊距），改其一必須同步改另一。

## 4. Regression tests

- [x] 4.1 新增 `packages/web/src/components/MarkdownRenderer.test.ts`（**副檔名必須是 `.test.ts`** —— web 的 test glob 是 `src/**/*.test.ts`，`.tsx` 不會被收），以 `react-dom/server` 的 `renderToStaticMarkup` + `React.createElement` 渲染真實 component（需 `MemoryRouter` 包裹，因 `code` override 會用到 `Link`），對齊 repo 既有純邏輯測試風格。
- [x] 4.2 斷言 task list 的 `ul` 帶有 `contains-task-list`、`li` 帶有 `task-list-item`（守住 1.1 / 1.2 的 class 轉發，這正是原本壞掉的點）。
- [x] 4.3 斷言 task list 的 `ul` 帶 `list-none`、一般 list 的 `ul` 帶 `list-disc`，且兩者皆為 `list-outside`、皆不含 `list-inside`（守住 defect 1 不回歸）。
- [x] 4.4 斷言 checkbox `input` 帶有負左邊距 class（守住 gutter pull 與 `pl-6` 的配對）。
- [x] 4.5 斷言 `- [~]` 渲染為一般 list item（`li` 不帶 `task-list-item`、文字含字面 `[~]`），釘住非目標的既有行為。

## 5. Verification

- [x] 5.1 `npm run type-check -w @spekjs/web` 全綠；`npm test -w @spekjs/web` 42/42 通過（含新增的 6 個 MarkdownRenderer 測試，且已驗證其中 5 個在還原修正後會失敗）。**`npm run lint -w @spekjs/web` 無法執行 —— eslint 未安裝於本 repo（不在任何 devDependencies），此為既有狀況，與本 change 無關。**
- [x] 5.2 `npm run build` 通過（core + ui + web）。
- [x] 5.3 **版面以瀏覽器實測驗證（非自動化 —— 單元測試驗不到幾何，見 §7.6）**。作法：把真實 component 的渲染輸出注入**真實建置產物的 CSS**（`dist/assets/index-*.css`）成一頁，以瀏覽器量測 `getComputedStyle` / `getBoundingClientRect`。實測值：
  - 混合清單 marker：task=`none`、一般項目=`disc`（容器 `list-disc`）
  - 有序 task list：兩項皆 `none`（數字未被蓋掉）
  - 多段項目：段間 16px > 項目間 4px（修正前為 0px）
  - checkbox 與首行同行：loose=true、mixed=true
  - 一般 loose 清單 marker 與內容同行：true
  - 長續行以 hanging indent 對齊首行、內嵌 blockquote（janitarr retrospective §6 形狀）排版正確：截圖確認
- [x] 5.4 用 `D:\git\janitarr`（schema `superpowers-bridge`）的 `plan.md` / `verify.md` / `retrospective.md` 實地覆核 —— 這是本 change 的回報來源，必須親眼確認修好。

## 7. 對抗性審查後的修正（四路 skeptic review 發現三個真實 bug）

- [x] 7.1 **混合清單 bug**：`list-none` 掛在容器上，導致 task + 一般項目並存時，一般項目連 marker 都沒有（裸文字）。改為逐項掛在 `li.task-list-item`。實測：容器 `list-disc`、task item `none`、一般項目 `disc`。
- [x] 7.2 **有序 task list bug**：`ol` 無 task 分支，`1. [ ]` 的數字與被 `-ml-6` 拉進同溝槽的 checkbox 重疊，渲染成 `☐. alpha`。7.1 的逐項作法同時修好（實測兩項皆 `none`）。
- [x] 7.3 **多段項目 bug**：`[&_li>p]:mb-0` 把同一項目內的段間壓成 0px（比項目之間的 4px 還小）。改為 `[&_li>p:last-of-type]:mb-0`。實測：段間 16px、項目間 4px，尾段 0px。
- [x] 7.4 補測試：混合清單、有序 task list、多段項目、`align-middle`（原本無人斷言，刪掉全綠）、loose `ol`；並修掉 blockquote containment 的**假斷言**（原 `/.*<blockquote/s` 會跨整份文件，blockquote 逃到 li 外也通過）—— 改為非貪婪且以 `</li>` 為界，另加反向案例確認它會拒絕逃逸情況。
- [x] 7.5 以 mutation 確認新測試真的會紅：marker 作用域→2 紅、`list-none` 回到容器→3 紅、全域 `mb-0`→1 紅、移除 `align-middle`→1 紅。
- [x] 7.6 **已知且刻意接受的限制**：對 checkbox 加上 `block` 會重現原始 bug 而測試**全綠**（實測 fail 0）。class 斷言無法驗版面，需版面 oracle（Playwright）才能守住，屬另一個 change。已寫入測試檔開頭與 design 的 Verification limits。
- [x] 7.7 審查**反駁**的疑慮（不需處理）：巢狀 list 的 `[&_li>p]` 洩漏（巢狀 list 帶有相同宣告，等同無效）、`-ml-6` 在 task list 外誤觸（無 `rehype-raw`，原始 HTML checkbox 會被跳脫成文字）、Tailwind 偵測失敗（實測全數產生）、`node` 比 `className` 可靠（`node` 是 optional，`className` 才是正式 prop）。
- [x] 7.8 **未採納**：`readOnly` → `disabled`（remark-gfm 已給 `disabled: true`，而 `readonly` 對 checkbox 無效，留下幽靈 tab stop）。此為**既有行為**且會改變視覺（disabled 會變灰），屬 UI 變更而非本 change 的斷行修正 —— 另開 change 處理。

## 6. Housekeeping

- [x] 6.1 **不** bump 版本、**不** 寫 CHANGELOG（依貢獻慣例，版本與 bundle 產出留給整合階段）。
- [x] 6.2 **不** rebuild `docs/demo.html`（建置產出，同上）。
- [x] 6.3 確認 diff 只動到 `MarkdownRenderer.tsx` + 新增的測試檔 + 本 change 的 openspec 文件。
