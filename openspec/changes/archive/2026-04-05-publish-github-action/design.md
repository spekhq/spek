## Context

GitHub Action (`action.yml`) 已實作完成，但尚未上架 Marketplace，且使用者只能用 `@master` 引用。GitHub Actions Marketplace 要求透過 GitHub Release 發布，且慣例上 action 提供 major version tag（如 `v1`）讓使用者在不指定 patch 版本的情況下自動取得最新修正。

## Goals / Non-Goals

**Goals:**
- 讓使用者能在 GitHub Actions Marketplace 搜尋並找到 spek action
- 提供 `v1` major version tag，使用者可用 `kewang/spek@v1`
- release skill 自動維護 `v1` tag，每次 release 自動更新
- README 範例引用 `@v1` 而非 `@master`

**Non-Goals:**
- 不建立獨立 action repo（action 留在主 repo）
- 不自動建立 GitHub Release（由 release skill 在下次 release 時處理）
- 不修改 action.yml 本身的功能

## Decisions

### Marketplace 發布方式
透過 GitHub Release 發布。action.yml 已有 `branding` 設定，只需在建立 release 時勾選 "Publish this Action to the GitHub Marketplace"。

**替代方案**：獨立 action repo → 增加維護成本，不採用。

### Major version tag 策略
將 npm 版本直接 bump 到 1.0.0（`npm version major`），使 `v1.0.0` tag 與 `v1` 浮動 tag 語意一致。後續每次 release 在 release skill 中將 `v1` tag 強制更新到新版本 commit。

```bash
git tag -fa v1 -m "Update v1 tag to v<version>"
git push origin v1 --force
```

**替代方案**：不維護 major tag，使用者直接用 `@v0.x.x` → 不符合 GitHub Action 社群慣例，使用者升級麻煩。

### README 更新範圍
兩份 README（`README.md` + `README.zh-TW.md`）的 GitHub Action 範例區段，將 `@master` 替換為 `@v1`。

## Risks / Trade-offs

- **Force push `v1` tag** → 這是 GitHub Action major version tag 的標準做法，風險可接受。使用者期望 `@v1` 會隨新版本更新。
- **首次 Marketplace 發布需手動操作** → 第一次需要在 GitHub web UI 建立 release 並勾選 Marketplace。後續可由 release skill 自動化（透過 `gh release create`）。
