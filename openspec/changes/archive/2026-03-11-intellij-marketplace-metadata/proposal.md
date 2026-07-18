## Why

IntelliJ plugin 已成功上架 JetBrains Marketplace，但多項元資料欄位缺漏或不完整（描述過於簡短、無 Marketplace icon、無 change notes、vendor 資訊不全），導致 Marketplace 頁面看起來不專業且缺乏可信度。此外，IntelliJ plugin 版號（0.1.1）與主專案版號（0.7.2）脫節，release 流程也未涵蓋 IntelliJ，需要全面統一。

## What Changes

- 新增 40x40 Marketplace plugin icon（`pluginIcon.svg`）
- 豐富 plugin description，加入功能介紹與使用說明
- 新增 change notes 機制，讓 Marketplace 顯示版本更新紀錄
- 補全 vendor 資訊（url）
- IntelliJ plugin 版號對齊主專案版號，`gradle.properties` 的 `pluginVersion` 隨 `npm version` 同步更新
- 新增 `packages/intellij/CHANGELOG.md`，內容與 root `CHANGELOG.md` 及 `packages/vscode/CHANGELOG.md` 同步
- 更新 release skill，讓 `/release` 同時處理 IntelliJ 的版號、CHANGELOG 和 change notes
- 更新 root `package.json` 的 `version` script，同步寫入 `gradle.properties`
- 更新 CLAUDE.md，CHANGELOG 同步規則擴展至 IntelliJ

## Capabilities

### New Capabilities
- `intellij-marketplace-metadata`: IntelliJ plugin 在 JetBrains Marketplace 上的元資料完整性要求，涵蓋 icon、description、change notes、vendor 資訊與 changelog

### Modified Capabilities
- `intellij-cicd`: release 流程需涵蓋 IntelliJ 版號同步與 CHANGELOG 更新

## Impact

- `packages/intellij/build.gradle.kts` — pluginConfiguration 區塊擴充（vendor url、change notes）
- `packages/intellij/gradle.properties` — pluginVersion 對齊主專案版號
- `packages/intellij/src/main/resources/META-INF/plugin.xml` — description、change-notes、vendor 更新
- `packages/intellij/src/main/resources/META-INF/pluginIcon.svg` — 新增檔案
- `packages/intellij/CHANGELOG.md` — 新增檔案
- `package.json` — version script 擴充，同步寫入 gradle.properties
- `.agents/skills/release/SKILL.md` — 加入 IntelliJ 相關步驟
- `CLAUDE.md` — CHANGELOG 同步規則更新
