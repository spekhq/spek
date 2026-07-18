## Context

`plugin.xml` 的 `<change-notes>` 停在 0.7.3，Marketplace 顯示過時資訊。現有 spec 已要求「release 時更新 change-notes」（`intellij-marketplace-metadata` Scenario: Change notes updated on release），但 release skill 未實作此步驟。

## Goals / Non-Goals

**Goals:**
- 將 `plugin.xml` change-notes 更新至 0.7.6
- 在 release skill 加入同步 `plugin.xml` change-notes 的步驟

**Non-Goals:**
- 不自動化產生 change-notes（仍由 release skill 手動寫入）
- 不改變 `plugin.xml` 的其他欄位

## Decisions

### 決策 1：change-notes 只顯示最新版本

**選擇**：`<change-notes>` 只放最新版本的變更摘要，不累積歷史。

**理由**：JetBrains Marketplace 的 "What's New" 區域設計上只顯示最新版本資訊，與 VS Code Marketplace 行為一致。完整歷史已有 CHANGELOG.md 記錄。

### 決策 2：在 release skill 的 CHANGELOG 步驟之後同步

**選擇**：在 release skill 的步驟 3（Update CHANGELOGs）之後加入步驟 3.5 更新 `plugin.xml` change-notes。

**理由**：CHANGELOG 內容已確認後，直接從中擷取最新版本的條目寫入 plugin.xml，確保兩者一致。

## Risks / Trade-offs

- **[風險] 忘記同步** → Release skill 明確列出此步驟，且步驟描述包含檔案路徑提醒
