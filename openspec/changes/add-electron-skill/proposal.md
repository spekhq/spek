## Why

spek 專案需要一個 Electron 自動化 skill，讓 Claude Code 能透過 Chrome DevTools Protocol 操控 Electron 桌面應用程式（VS Code、Slack、Discord 等）。此 skill 已以 `.agents/skills/electron/` 的形式加入專案，需正式納入 OpenSpec 記錄。

## What Changes

- 新增 `.agents/skills/electron/` 目錄，包含 `SKILL.md`（skill 定義與使用指引）
- 新增 `.claude/skills/electron` symlink 指向 `.agents/skills/electron`，讓 Claude Code 自動偵測並載入
- Skill 觸發條件：使用者要求自動化 Electron 桌面應用、連線到執行中的 app、控制原生應用程式或測試 Electron 應用時
- Skill 內容涵蓋 CDP 連線流程、Tab 管理、截圖、資料擷取、表單填寫、多 App 同時操作等

## Capabilities

### New Capabilities

- `electron-skill`: Claude Code skill 的結構定義與 Electron 自動化指引，涵蓋 skill 目錄結構、symlink 設定、觸發條件、CDP 連線與操作規範

### Modified Capabilities

（無）

## Impact

- 新增檔案：`.agents/skills/electron/SKILL.md`
- 新增 symlink：`.claude/skills/electron`
- 不影響 spek 核心程式碼、API 或 build 流程
