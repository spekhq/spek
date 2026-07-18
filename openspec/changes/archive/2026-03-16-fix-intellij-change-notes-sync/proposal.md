## Why

IntelliJ plugin 的 `plugin.xml` 中 `<change-notes>` 區段停留在 0.7.3 版本，但專案已發佈到 0.7.6。Release skill 只同步三份 CHANGELOG，未涵蓋 `plugin.xml`，導致 JetBrains Marketplace 上的 "What's New" 資訊過時。

## What Changes

- 更新 `plugin.xml` 的 `<change-notes>` 至最新版本（0.7.6）內容
- 在 release skill 中新增步驟：release 時自動同步 `plugin.xml` change-notes

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `intellij-marketplace-metadata`: 新增要求 — release 流程必須同步更新 `plugin.xml` 的 `<change-notes>` 區段

## Impact

- `packages/intellij/src/main/resources/META-INF/plugin.xml` — 更新 change-notes 內容
- `.agents/skills/release/SKILL.md` — 新增同步 plugin.xml 的步驟
