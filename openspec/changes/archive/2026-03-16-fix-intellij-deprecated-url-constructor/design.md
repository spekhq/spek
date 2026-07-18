## Context

`SpekBrowserPanel.waitForApiReady()` 使用 `URL(String)` 建構子建立 HTTP 連線來偵測 Built-in Server 是否就緒。此建構子自 Java 20 起被標記為 `@Deprecated(since = "20")`，IntelliJ Plugin Verifier 會將其報告為相容性警告。

目前受影響的程式碼位於 `SpekBrowserPanel.kt` 第 273 行：
```kotlin
val conn = URL(checkUrl).openConnection() as HttpURLConnection
```

## Goals / Non-Goals

**Goals:**
- 消除 Plugin Verifier 的 deprecated API 警告
- 使用 Java 標準替代方案 `URI(...).toURL()`

**Non-Goals:**
- 不變更 `waitForApiReady` 的行為邏輯
- 不重構 HTTP 連線方式（如改用 OkHttp 或 HttpClient）

## Decisions

- **使用 `URI(checkUrl).toURL()` 替代 `URL(checkUrl)`**：這是 Java 官方建議的遷移路徑，語義完全等價，且 `URI` 類別不會被棄用。替代方案如 `HttpClient`（Java 11+）雖更現代，但對此單一用途來說改動過大，不符比例原則。

## Risks / Trade-offs

- [風險極低] `URI` 對 URL 格式校驗比 `URL` 稍嚴格 → 但此處使用的是固定格式 `http://localhost:$port/...`，不會有解析問題
