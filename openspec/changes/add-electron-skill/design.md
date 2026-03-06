## Context

spek 專案新增 electron skill，讓 Claude Code 在處理 Electron 桌面應用自動化任務時自動載入操作指引。檔案已放置於 `.agents/skills/electron/`，並透過 `.claude/skills/electron` symlink 讓 Claude Code 偵測。

## Goals / Non-Goals

**Goals:**
- 將 electron skill 檔案正式納入專案版本控制
- 延續 `.agents/skills/` 存放 skill 的既有慣例
- 透過 `.claude/skills/` symlink 機制讓 Claude Code 自動載入

**Non-Goals:**
- 不修改 spek 的核心程式碼或 UI
- 不建立 skill 的自動化測試或 CI 整合
- 不變更現有 build 流程

## Decisions

### 1. 沿用 `.agents/skills/` + symlink 慣例

**選擇**：skill 原始檔放在 `.agents/skills/electron/`，`.claude/skills/electron` 為 symlink。

**理由**：與既有的 `frontend-design` skill 一致，維持統一的 skill 存放慣例。

### 2. Skill 內容為純靜態文件

**選擇**：skill 僅包含 `SKILL.md`，無額外程式碼或授權檔。

**理由**：electron skill 是 prompt-level 的操作指引，透過 `allowed-tools` frontmatter 宣告所需工具權限，不需要執行任何程式碼。

## Risks / Trade-offs

- **[agent-browser 依賴]** → skill 假設使用者環境已安裝 agent-browser CLI；若未安裝，skill 指引中的指令會失敗。目前僅為指引文件，不做安裝驗證
- **[跨平台差異]** → Electron app 啟動指令在 macOS/Linux/Windows 不同；skill 已涵蓋三平台範例
