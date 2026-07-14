## Context

Sidebar 底部的 `ResyncButton`（`packages/web/src/components/Sidebar.tsx`）呈現一個環形箭頭圖示，收合狀態下更只剩圖示、沒有文字。使用者讀成 refresh，按下去卻什麼都不會變 —— `useResync` 只 POST `/api/openspec/resync` 重建伺服端的 git timestamp 快取，**從未呼叫 `RefreshContext` 的 `refresh()`**，`refreshKey` 不動，`useAsyncData` 就不重取。

三個宿主共用同一個 React `Layout`，所以這顆按鈕在 Web / VS Code / IntelliJ 都看得到，但只有 Web 與 VS Code 有對應的伺服端處理；IntelliJ 的 `SpekHttpRequestHandler.routeRequest` 沒有這條路由，按下去是 404，而 `useResync` 沒有 `catch`，於是變成 unhandled rejection。

調查中另外發現 `useFileWatcher` 在 IntelliJ 下會誤判環境：它既不是 demo、也沒有 `__vscodeApi`、`repoPath` 又有值，於是掉進 Web 分支對 `/api/openspec/watch` 開 `EventSource`。IntelliJ 內建 server 只服務 `/api/spek/` 前綴，這條路徑必然 404，`EventSource` 因此永遠重連、永遠失敗。IntelliJ 真正的刷新管道是 JCEF 注入的 `spek:fileChanged` window event。

伺服端快取盤點（決定 refresh 該讓什麼失效）：

| 快取 | Web / VS Code | IntelliJ |
|---|---|---|
| git timestamp（`git-cache.ts`） | 有，無 TTL，只能由 resync 清 | **無**（Kotlin scanner 的 `timestamp` 恆為 `null`） |
| schema order（CLI `openspec status`） | 有，30 秒 TTL，會自癒 | 有，且 file watcher 刷新前已會 `SchemaOrder.clearCache()` |

本機實測（原生檔案系統、Web 版 SSE）file watcher 是正常的：編輯 `tasks.md` 會立刻推出 `{"type":"changed"}`，`/changes/:slug` 也馬上回傳新 task。回報者環境下的 watcher 失效無法重現，本 change 不猜根因。

## Goals / Non-Goals

**Goals:**

- 那顆按鈕做到它看起來會做的事：重新載入畫面上的資料。
- 這個保證不因任何一個宿主的伺服端差異而破功。
- 按鈕的忙碌狀態必須誠實 —— 涵蓋到資料真正抵達為止，而不是在資料落地前就停止。
- watcher 靜默失效變成看得見的狀態，使用者知道該手動 refresh。
- 移除 IntelliJ 那條永遠失敗的 `EventSource` 重連迴圈。

**Non-Goals:**

- **不追 watcher 在回報者環境下失效的根因。** 無法重現，猜根因等於亂投藥。改以「失效可見 + 手動退路可用」收斂，並向回報者索取環境資訊另案處理。
- 不改 schema-order 快取的失效時機。它有 30 秒 TTL 會自癒；為它新增一個 `clearSchemaOrderCache()` 會擴張 `@spekjs/core` 的公開 API（獨立發佈、獨立版本線），代價與收益不成比例。
- 不改 `useAsyncData` 既有的取數語意（300ms debounce、refresh 期間保留舊資料不閃 loading、refresh 失敗且有舊資料時不設 error）。本 change 只在其外圍加上儀器（instrumentation）。

## Decisions

### 一顆按鈕，不是兩顆

把 Resync 正名為 **Refresh**，語意是「讓伺服端該失效的失效 + 重新取數」。

不新增一顆獨立的 Refresh、與 Resync 並存：兩顆都是環形箭頭、語意高度重疊，正是製造這個 issue 的配方。而且不存在「我想重建 timestamp 快取但不想看到結果」這種使用情境 —— resync 的唯一意義就是為了讓接下來取到的資料是對的。「重建 git timestamp 快取」是實作細節，UI 不該逼使用者去分辨它跟「重新載入」的差別。

### 契約放在 hook 裡，不放在 onClick

`useResync` 改為 `useRefreshData`，內部保證：

```
setLoading(true)
try   { await adapter.resync() }   // best-effort
catch { /* 宿主可能沒有此端點或沒有快取可失效 —— 不得阻擋重新取數 */ }
finally { refresh() }              // 一定執行
```

**「快取失效失敗不得阻擋重新取數」是這個 change 的核心不變式**，所以它必須被寫死在單一位置。若放在 Sidebar 的 `onClick` 裡拼裝，下一個呼叫者就會漏掉它 —— 而這正是 IntelliJ 那個 404 能讓整顆按鈕啞掉的原因。

### 每個宿主失效自己真正擁有的快取

IntelliJ 新增 `openspec/resync` 路由，但它做的不是重建 git timestamp（Kotlin scanner 沒有這個快取），而是 `SchemaOrder.clearCache()` —— 它的 file watcher 在刷新前本來就會做這件事（`SpekBrowserPanel.kt:287`），手動 refresh 沒有理由做得比較少。

這看似與 Web / VS Code 不對稱，但那不是壞味道：**每個宿主誠實地失效自己實際持有的狀態**。強求三邊清同一組快取，只會逼出一個假的 no-op 端點（IntelliJ 沒有 timestamp 快取可清）或一個多餘的 core API（Web 端不需要清 schema order，它會自癒）。

考慮過的替代方案是完全不加這條路由、讓前端吞掉 404。否決：使用者每按一次 Refresh 就在 IDE 記一筆 404，是個假的錯誤訊號；而且前端的容錯是**安全網**，不該被當成常態路徑來用。兩者都要 —— 路由讓正常路徑乾淨，容錯讓異常路徑不致命。

### 忙碌狀態要涵蓋到資料落地

目前 `loading` 只涵蓋 resync 這個 POST（數毫秒），但真正的重取要等 `refreshKey` 變動後的 300ms debounce 才開始。也就是說 spinner 會在資料抵達之前就停 —— **一個對「我做完了」說謊的按鈕，正是這個 issue 的成因**。使用者按下去、看到一個幾乎察覺不到的閃動、內容沒變，於是得出「這顆按鈕壞了」的結論；就算資料真的更新了，他也無從分辨「refresh 成功但內容本來就沒變」與「refresh 根本沒作用」。

所以 `RefreshContext` 增加在途取數計數：

- `refresh(manual)` — `manual` 為真時同時 arm 忙碌狀態。watcher 觸發的自動刷新**不** arm（自動更新時憑空冒出 spinner 是噪音）。
- `useAsyncData` 在自己的 fetch 前後呼叫 `beginFetch()` / `endFetch()`。
- `refreshing` 自 arm 起為真，直到「已有 fetch 開始過**且**在途數歸零」。
- 退化保護：arm 後 300ms（即 `useAsyncData` 的 debounce 上限）內若無任何 fetch 開始（例如當下沒有掛載任何取數 hook），`refreshing` 自行解除，不會卡死。

這是本 change 唯一碰到 `useAsyncData` 的地方，且純屬儀器：既有的 debounce、保留舊資料、吞掉 refresh 期間錯誤等語意一律不動。

### watcher 狀態：只在壞掉時說話

`RefreshContext` 一併暴露 `liveStatus`：

- Web：`EventSource` 的 `onopen` → `live`；`onerror` 且 `readyState !== OPEN` → `offline`。（目前 `onerror` 完全沒有處理，斷線是無聲的。）
- VS Code / IntelliJ：`live`。其 postMessage / `spek:fileChanged` 管道沒有可觀測的失敗訊號，謊報 offline 比不報更糟。
- Demo：`unsupported`，UI 完全不顯示。

UI 只在 `offline` 時出聲：sidebar 顯示一行「Live updates offline」提示使用者手動 Refresh。不做常駐的綠點 —— 一個永遠亮著的「正常」指示燈是純噪音，而且會鈍化真正出事時的訊號。

### `useFileWatcher` 補上 IntelliJ 分支

以 `INTELLIJ_API_BASE` 之類的 IntelliJ 標記判定環境後直接 no-op：IntelliJ 的刷新由 `IntellijApp` 監聽 `spek:fileChanged` 完成，`useFileWatcher` 不該再開任何連線。這同時消掉那個永遠失敗的重連迴圈。

## Risks / Trade-offs

- **[改動 `useAsyncData` 會波及所有取數 hook]** → 只加 `beginFetch()` / `endFetch()` 兩個呼叫，不動任何既有分支邏輯；`live-reload` 既有的四個 `useAsyncData` scenario 原封不動，可作為回歸護欄。
- **[`refreshing` 可能卡在真]** → 300ms arm-timeout 保底。代價是極端情況下 spinner 會早停，但早停遠優於卡死。
- **[watcher 的根因仍未知]** → 本 change 不宣稱修好 watcher。它把「靜默失效」降級為「看得見的失效 + 一個真的能用的手動退路」，這在任何根因下都成立。根因待回報者提供環境資訊（surface、OS、repo 是否位於 devcontainer / WSL / 網路磁碟）後另案處理。
- **[三個宿主的 resync 語意不同]** → 明文寫進 spec：resync 的契約是「讓本宿主持有的、會導致陳舊視圖的伺服端狀態失效」，而非「執行某一組固定動作」。
- **[Resync → Refresh 是使用者可見的文案變更]** → 三條發行通道的 CHANGELOG 都要記；沒有人依賴 "Resync" 這個字串，無相容性問題。
