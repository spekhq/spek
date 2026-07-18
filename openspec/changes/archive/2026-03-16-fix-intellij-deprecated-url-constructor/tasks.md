## 1. 替換棄用 API

- [x] 1.1 將 `SpekBrowserPanel.kt` 中的 `import java.net.URL` 替換為 `import java.net.URI`
- [x] 1.2 將 `waitForApiReady()` 中的 `URL(checkUrl).openConnection()` 替換為 `URI(checkUrl).toURL().openConnection()`

## 2. 驗證

- [x] 2.1 執行 `./gradlew buildPlugin` 確認編譯成功
- [x] 2.2 執行 Plugin Verifier 確認不再出現 deprecated API 警告
