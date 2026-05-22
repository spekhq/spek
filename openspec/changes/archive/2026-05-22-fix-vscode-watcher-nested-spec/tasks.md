## 1. 依賴與共用 helper

- [x] 1.1 在 `packages/vscode/package.json` 的 `devDependencies` 加入 `chokidar`（對齊 `packages/web` 的版本），執行 `npm install`
- [x] 1.2 新增 `packages/vscode/src/watcher.ts`，匯出 `watchOpenspecDir(dir: string, onChange: () => void): vscode.Disposable`：對 `<dir>/openspec` 建立 chokidar watcher，設定比照 `packages/web/server/routes/openspec.ts`（`ignored` 過濾非 `.md`/`.yaml`、`ignoreInitial: true`、`persistent: true`），監聽 `add`/`addDir`/`change`/`unlink`/`unlinkDir` 皆轉呼叫 `onChange`，回傳的 `dispose()` 呼叫 `FSWatcher.close()`

## 2. 替換 VS Code 兩處 watcher

- [x] 2.1 `packages/vscode/src/panel.ts`：改寫 `watchOpenspec` 使用 `watchOpenspecDir`，移除 `createFileSystemWatcher`/`RelativePattern`，保留 `notifyFileChange` 的 500ms debounce 與 `postMessage({ type: "fileChanged" })`，watcher disposable 仍放入 `this.disposables`（`addWorktreeWatchers` 透過 `watchOpenspec` 自動沿用）
- [x] 2.2 `packages/vscode/src/extension.ts`：改寫 `treeWatcher` 使用 `watchOpenspecDir`，移除 `createFileSystemWatcher`/`RelativePattern`，保留 `refreshTree` 的 500ms debounce，watcher disposable 仍放入 `context.subscriptions`
- [x] 2.3 清理 `panel.ts`/`extension.ts` 中因替換而不再使用的 import

## 3. 打包與驗證

- [x] 3.1 依序建置 `@spek/core` → `build:webview` → `spek-vscode`，確認 esbuild 無錯誤且 chokidar 已內聯進 `dist/extension.js`
- [x] 3.2 `vsce package --no-dependencies` 打包後於 Extension Development Host 驗證：開啟一個 change、切到 Specs tab，對 `changes/<slug>/specs/<topic>/spec.md` 寫入內容，確認 spec tab 在「首次建立」與「後續編輯」兩種情況都會自動更新
