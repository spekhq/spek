## 1. Badge 產生腳本

- [x] 1.1 建立 `scripts/generate-badges.ts`，接受 `--repo-dir` 和 `--output-dir` 參數
- [x] 1.2 使用 `@spek/core` 的 `scanOpenSpec` 取得 specs 數量、active changes 數量、task 統計
- [x] 1.3 實作 SVG badge 模板（flat style），產生 `specs.svg`、`open_changes.svg`、`tasks.svg`

## 2. Action 整合

- [x] 2.1 在 `action.yml` 新增 `generate-badges` input（boolean，預設 false）
- [x] 2.2 在 `action.yml` 新增 `badges-path` output
- [x] 2.3 在 `action.yml` 新增 badge 產生步驟（條件執行：`generate-badges == 'true'` 時）

## 3. 本地 build 整合

- [x] 3.1 在 `package.json` 新增 `build:badges` npm script
- [x] 3.2 在 release skill 新增步驟：release 時自動產生 badges 到 `docs/badges/`

## 4. 文件更新

- [x] 4.1 在 `README.md` 和 `README.zh-TW.md` 的 GitHub Action 段落新增 badge 使用範例
- [x] 4.2 在 `README.md` 和 `README.zh-TW.md` 頂部放上 spek 自己的 badge 圖片
