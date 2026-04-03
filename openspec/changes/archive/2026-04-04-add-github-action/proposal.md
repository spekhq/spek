## Why

GitHub issue #1 (by @mipmip) 建議提供 GitHub Action，讓其他使用 OpenSpec 的專案能在 CI 中自動建置靜態 spec 網站並部署到 GitHub Pages。目前 `build-demo.ts` 已能產出獨立靜態 HTML，但寫死了只掃描 spek 自身的 repo，且沒有 Action 封裝讓外部專案使用。

## What Changes

- 將 `scripts/build-demo.ts` 參數化，支援 `--repo-dir`、`--output`、`--title` CLI 參數，可指定外部 repo 路徑
- 新增 `action.yml` composite action，讓其他 repo 透過 `uses: kewang/spek@v1` 自動建置 OpenSpec 靜態網站
- 新增 dogfood workflow（`.github/workflows/build-demo.yml`），spek 自身也用此 action 建置 demo

## Capabilities

### New Capabilities
- `github-action`: GitHub Action composite action 定義，提供 inputs（repo-path、output-path、title、spek-version）與 outputs（html-path），自動 checkout spek、安裝依賴、建置靜態網站

### Modified Capabilities
- `core-module`: `build-demo.ts` 需參數化以支援外部 repo 路徑（資料來源與 build 工具路徑分離）

## Impact

- `scripts/build-demo.ts`：新增 CLI 參數解析，將 `ROOT` 引用拆分為 `REPO_DIR`（資料來源）與 `ROOT`（build 工具）
- 新增 `action.yml`（repo 根目錄）
- 新增 `.github/workflows/build-demo.yml`
- 向下相容：`npm run build:demo`（無參數）行為不變
