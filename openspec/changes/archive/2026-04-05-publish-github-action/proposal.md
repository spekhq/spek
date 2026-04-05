## Why

GitHub Action (`action.yml`) 已在前一個 change 中建好，但使用者（issue #1 @mipmip）目前無法方便地使用：action 尚未上架 GitHub Actions Marketplace、沒有穩定的版本 tag（只能用 `@master`）、README 中的範例也指向 `@master`。需要完成發布流程讓外部使用者能透過 Marketplace 找到並使用此 action。

## What Changes

- 將 npm 版本從 0.7.9 bump 到 1.0.0（`npm version major`），正式宣告穩定版
- 上架 GitHub Actions Marketplace：透過 GitHub Release 發布，勾選 Marketplace 選項
- 建立 `v1` 浮動 major version tag 指向 `v1.0.0`，讓使用者可用 `kewang/spek@v1`（GitHub Action 慣例）
- 將 release skill 更新為在每次 release 時自動維護 `v1` tag 並建立 GitHub Release
- 更新 README 中 GitHub Action 範例，將 `@master` 改為 `@v1`

## Capabilities

### New Capabilities

（無新增 capability — 此 change 屬於發布與文件更新）

### Modified Capabilities

- `github-action`: 新增 Marketplace 發布要求與 major version tag 慣例

## Impact

- `README.md` / `README.zh-TW.md`：GitHub Action 範例中的版本引用從 `@master` 改為 `@v1`
- `.agents/skills/release/SKILL.md`：release 流程新增步驟 — 更新 `v1` tag 指向新版本
- GitHub Releases：需建立 release 並勾選 Marketplace 發布
