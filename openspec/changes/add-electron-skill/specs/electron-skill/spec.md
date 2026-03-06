## ADDED Requirements

### Requirement: Electron skill 目錄結構
skill 原始檔 SHALL 存放於 `.agents/skills/electron/SKILL.md`，並透過 `.claude/skills/electron` symlink 指向原始目錄。

#### Scenario: Skill 檔案存在
- **WHEN** 檢查 `.agents/skills/electron/SKILL.md`
- **THEN** 檔案存在且包含有效的 SKILL.md frontmatter（name、description、allowed-tools）

#### Scenario: Symlink 正確指向
- **WHEN** 檢查 `.claude/skills/electron`
- **THEN** 該 symlink 指向 `../../.agents/skills/electron`

### Requirement: Skill 觸發條件
skill SHALL 在使用者要求自動化 Electron 桌面應用、連線到執行中的 app、控制原生應用程式或測試 Electron 應用時觸發。

#### Scenario: 使用者要求自動化 Electron app
- **WHEN** 使用者輸入包含 "automate Slack app"、"control VS Code"、"interact with Discord app"、"test this Electron app"、"connect to desktop app" 等觸發詞
- **THEN** Claude Code 自動載入 electron skill 指引

### Requirement: Skill 內容涵蓋 CDP 操作指引
skill SKILL.md SHALL 包含 Chrome DevTools Protocol 連線流程、Tab 管理、截圖、資料擷取、表單填寫、多 App 同時操作、色彩配置與故障排除等章節。

#### Scenario: 使用者需要連線 Electron app
- **WHEN** 使用者依照 skill 指引啟動 Electron app 並透過 agent-browser 連線
- **THEN** skill 提供完整的 CDP 連線指令範例（含 macOS、Linux、Windows）
