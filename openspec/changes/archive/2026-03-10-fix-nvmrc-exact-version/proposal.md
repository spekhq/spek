## Why

`.nvmrc` 目前僅指定大版本號 `22`，導致 nvm 在部分環境下無法自動解析對應的 Node.js 版本，使得 openspec CLI 等依賴正確 Node.js 版本的工具無法執行。改為精確版本號可確保所有開發者與 CI 環境一致。

## What Changes

- 將 `.nvmrc` 從 `22` 改為 `22.22.0`，指定精確的 Node.js 版本號

## Capabilities

### New Capabilities

（無新增功能）

### Modified Capabilities

（無 spec 層級的需求變更，僅開發環境設定調整）

## Impact

- 僅影響 `.nvmrc` 檔案
- 不影響任何程式碼、API 或依賴
- 所有開發者需確保本機已安裝 Node.js 22.22.0
