## Context

spek 的 `build-demo.ts` 已能掃描 openspec/ 目錄並產出獨立靜態 HTML，但目前寫死只讀 spek 自身 repo。GitHub issue #1 要求提供 GitHub Action 讓外部專案也能使用此功能。

spek 是 private monorepo（未發佈 npm），所以 Action 無法透過 `npm install` 取得 spek，需要在 runtime checkout spek repo。

## Goals / Non-Goals

**Goals:**
- 讓任何包含 openspec/ 的 repo 能透過一行 `uses: kewang/spek@v1` 自動建置靜態 spec 網站
- 向下相容：`npm run build:demo` 無參數時行為不變
- 提供 dogfood workflow 作為使用範例

**Non-Goals:**
- 不發佈 spek 到 npm registry
- 不在 Action 內處理 GitHub Pages 部署（使用者自行搭配 `actions/deploy-pages`）
- 不做 OpenSpec 內容驗證或 linting

## Decisions

### Composite Action（非 Docker）
Action 使用 composite 類型，步驟為：checkout spek → setup Node.js → npm ci → build core → 執行 build-demo.ts。

**理由**：純 Node.js 工具鏈，不需要 Docker 額外複雜度。Composite action 透明且容易除錯。

**替代方案**：Docker action 會增加 Dockerfile 維護成本且拉長啟動時間，無明顯優勢。

### CLI 參數解析用 process.argv
`build-demo.ts` 透過簡單的 `process.argv` 解析 `--repo-dir`、`--output`、`--title` 三個參數。

**理由**：只有三個參數，不值得引入 CLI 框架（yargs、commander）。保持零額外依賴。

### spek checkout 到 `.spek-builder/` 子目錄
Action 用 `actions/checkout` 將 spek repo 放到使用者 workspace 的 `.spek-builder/` 目錄。

**理由**：dotfile 前綴減少與使用者檔案衝突的風險。build 完成後可清理。

### 輸出預設 `spek-output/spek.html`
預設輸出用 `spek.html`。

**理由**：使用者部署到 GitHub Pages 後，網址為 `<user>.github.io/<repo>/spek.html`，語義清晰。

## Risks / Trade-offs

- **Build 時間**：每次 CI 都要 `npm ci` 安裝 spek 完整依賴（React、Vite、Tailwind 等），約需 30-60 秒。→ 加入 `actions/cache` 快取 node_modules。
- **git history 依賴**：`@spek/core` 的 `git-cache.ts` 用 `git log` 取得 change timestamps，使用者需 `fetch-depth: 0`。→ 文件中明確說明，缺少時 graceful fallback 為 null。
- **spek 版本鎖定**：使用者透過 `spek-version` input 指定版本，若未指定預設用 `master`。→ 建議文件推薦使用 tag（如 `v0.7.7`）。
