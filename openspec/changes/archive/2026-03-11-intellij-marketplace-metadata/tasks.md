## 1. Plugin Icon

- [x] 1.1 建立 `packages/intellij/src/main/resources/META-INF/pluginIcon.svg`（40x40px），以現有 spek.svg 為基礎放大設計

## 2. Plugin Description

- [x] 2.1 更新 `plugin.xml` 的 `<description>` CDATA 區塊，加入 HTML 格式的完整功能介紹（用途概述、功能列表、支援 IDE 範圍）

## 3. Change Notes

- [x] 3.1 在 `plugin.xml` 中新增 `<change-notes>` CDATA 區塊，列出目前版本的變更摘要

## 4. Vendor 資訊

- [x] 4.1 更新 `plugin.xml` 的 `<vendor>` 元素，加入 `url` 屬性指向 GitHub repo
- [x] 4.2 更新 `build.gradle.kts` 的 vendor 區塊，加入 `url`

## 5. 版號同步

- [x] 5.1 更新 `packages/intellij/gradle.properties` 的 `pluginVersion` 為當前主專案版號
- [x] 5.2 擴充 root `package.json` 的 `version` script，同時寫入 `packages/intellij/gradle.properties` 的 `pluginVersion`

## 6. CHANGELOG 同步

- [x] 6.1 建立 `packages/intellij/CHANGELOG.md`，內容複製自 root `CHANGELOG.md`
- [x] 6.2 更新 CLAUDE.md 的 CHANGELOG 同步規則，加入 IntelliJ

## 7. Release Skill 擴充

- [x] 7.1 更新 `.agents/skills/release/SKILL.md` 步驟 3，同時更新 `packages/intellij/CHANGELOG.md`
- [x] 7.2 更新 `.agents/skills/release/SKILL.md` 步驟 4 的 git add，加入 IntelliJ CHANGELOG
- [x] 7.3 更新 `.agents/skills/release/SKILL.md` 步驟 7 和 8 的訊息，加入 JetBrains Marketplace
- [x] 7.4 更新 `.agents/skills/release/SKILL.md` 的 Guardrails，三份 CHANGELOG 同步規則
