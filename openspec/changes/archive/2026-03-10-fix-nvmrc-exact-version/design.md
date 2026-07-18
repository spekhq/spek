## Context

`.nvmrc` 目前內容為 `22`，僅指定大版本號。在部分環境中，nvm 無法自動解析此格式為具體可安裝的版本，導致 `nvm use` 失敗，進而影響 openspec CLI 等工具執行。

## Goals / Non-Goals

**Goals:**
- 將 `.nvmrc` 改為精確版本號 `22.22.0`，確保 nvm 在所有環境下都能正確切換

**Non-Goals:**
- 不涉及 Node.js 版本升級（仍維持 22.x）
- 不涉及任何程式碼變更

## Decisions

- **使用精確的 patch 版本號**：選擇 `22.22.0` 而非 `v22` 或 `lts/*`，因為精確版本號在所有 nvm 版本中都有最佳相容性，且能確保團隊成員使用完全相同的 Node.js 版本。

## Risks / Trade-offs

- [風險] 未來 Node.js 更新時需手動更新 `.nvmrc` → 這是預期行為，版本升級應為有意識的決定
