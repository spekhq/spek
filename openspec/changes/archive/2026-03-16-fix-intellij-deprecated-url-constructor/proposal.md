## Why

IntelliJ Plugin Verifier 報告 `SpekBrowserPanel.waitForApiReady()` 中使用了已棄用的 `URL(String)` 建構子。此建構子自 Java 20 起被標記為 deprecated，未來版本可能移除，造成二進位與原始碼不相容。需要將其替換為 `URI(...).toURL()` 以消除警告並確保前向相容性。

## What Changes

- 將 `SpekBrowserPanel.waitForApiReady()` 中的 `URL(checkUrl).openConnection()` 替換為 `URI(checkUrl).toURL().openConnection()`
- 對應的 import 從 `java.net.URL` 改為 `java.net.URI`

## Capabilities

### New Capabilities

（無新增功能）

### Modified Capabilities

（無需求層級變更，僅為實作層面的 API 遷移）

## Impact

- 受影響檔案：`packages/intellij/src/main/kotlin/com/spek/intellij/SpekBrowserPanel.kt`
- 僅影響 IntelliJ plugin，不影響其他 package
- 無 API 或行為變更，純粹為棄用 API 替換
