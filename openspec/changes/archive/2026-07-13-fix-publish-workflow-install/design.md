## Context

`npm ci` 在乾淨 runner 上失敗，兩個發佈 workflow 都停在第一步。錯誤是 `@spekjs/ui` 的 `tsc` 找不到 `@spekjs/core` 的型別宣告。

診斷時的關鍵觀察（在乾淨 clone 重現得到）：`npm ci` 中止後，`packages/core/dist/index.d.ts` **是存在的** —— core 的 `prepare` 有跑、也成功產出 dist；但 `node_modules/@spekjs/` 是**空目錄**，workspace symlink 根本還沒建立。

這推翻了最直覺的假設「ui 比 core 早 build，所以是順序問題」。真正的成因是**時機**：npm 在 install 期間執行 workspace 的 `prepare`，而該階段 workspace 之間的 symlink 尚未 finalize。因此不論 core 是否已經 build 完，ui 的 `tsc` 都無從解析 `@spekjs/core` —— 它要走的那條 `node_modules/@spekjs/core` 路徑不存在。任何「排順序」的修法都救不了。

## Goals / Non-Goals

**Goals**
- 乾淨 checkout 的 `npm ci` 不再因為任何 workspace 在 install 期間 build 而失敗。
- 需要 `@spekjs/ui` dist 的流程（web build、兩個 webview bundle、CI）仍然拿得到 dist。
- 不改動任何會進 bundle 的程式碼 —— 發佈出去的產品內容必須與 v1.6.1 tag 上的一致。

**Non-Goals**
- 不重整 monorepo 的 build 編排（不引入 turbo / nx / tsc project references）。
- 不改變 `@spekjs/ui` 對外的發佈方式與版本線。

## Decisions

### D1 — `prepare` → `prepublishOnly`：install 不 build，publish 才 build

`prepare` 同時涵蓋 install 與 publish 兩個時機，而我們只需要後者。`prepublishOnly` 只在 `npm publish` 時執行，`npm ci` / `npm install` 完全不碰它，於是「build 需要 symlink、symlink 卻在 build 之後才建」這個環就斷了。

代價：`npm install` 之後 `packages/ui/dist` 不會自動存在。這可以接受，因為所有需要它的入口都已經顯式 build ui：root 的 `dev`、`build`、`build:web`、`build:webview`、`build:intellij`、`build:demo` 全都串了 `build:ui`。唯一會踩到的是有人繞過 root script、直接跑 `npm run dev -w @spekjs/web`；那條路徑本來就不是文件寫的用法。

### D2 — 被否決的替代方案

- **調整 build 順序 / 讓 core 先 build。** 如上所述，core 早就先 build 完了，dist 也在，症狀依舊。順序不是根因。
- **`npm ci --ignore-scripts`。** 會一併停掉 core 的 `prepare`（那個是有用的，它讓 install 後 core/dist 就緒），而且只修 CI、不修任何人在乾淨機器上的 `npm ci`。把問題藏起來而不是解決。
- **把 `@spekjs/core` 從 ui 的 devDependencies 移到 dependencies。** 不改變 `prepare` 在 symlink 之前執行的事實，症狀不會消失；而且 core 對 ui 而言語意上就是 peer（宿主提供），改成 runtime dependency 會讓發佈出去的套件多背一個不該背的相依。
- **讓 ui 的 tsconfig 直接指向 `../core/src`。** 能繞過 symlink，但等於把「monorepo 的目錄佈局」寫進一個要發佈到 npm 的套件裡。`@spekjs/ui` 的存在目的就是給 repo 外的宿主用，它不該假設自己住在這個 monorepo 裡。

### D3 — VS Code workflow 改呼叫 root 的 `build:webview`

拿掉 install 期的 build 之後，dist 的產生者必須是明確的 build 步驟。root 的 `build:webview` 已經是 `build:ui && build:webview -w @spekjs/web`，直接用它即可；原本 workflow 跳過 root、直接呼叫 `@spekjs/web` 的同名 script，正好漏掉 build ui 這一段（過去靠 `prepare` 意外補上了，所以沒人發現）。

IntelliJ workflow 呼叫的是 root 的 `build:intellij`，本來就含 `build:ui`，不需更動 —— 它會失敗純粹是被 `npm ci` 擋在門外。

## Risks / Trade-offs

- **本機測不出來。** 既有的 `node_modules` 是 `npm install` 累積出來的，symlink 早就在，`prepare` 因此永遠成功。驗證這類問題**必須**在乾淨 clone 上跑 `npm ci`（見 tasks 3.1），否則綠燈是假的。
- **`prepublishOnly` 對 `npm pack` 不生效。** 若日後改用 `npm pack` 產 tarball 再上傳，要記得先手動 build（或改用 `prepack`）。目前的發佈路徑是 `npm publish`，不受影響。
