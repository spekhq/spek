## ADDED Requirements

### Requirement: Marketplace plugin icon
Plugin JAR SHALL 包含 Marketplace 專用 icon，讓 JetBrains Marketplace 和 IDE plugin 列表正確顯示 spek 圖示。

#### Scenario: Icon file exists in correct location
- **WHEN** 建置 plugin JAR
- **THEN** `META-INF/pluginIcon.svg` 存在於 JAR 中，尺寸為 40x40px

#### Scenario: Icon displays on Marketplace
- **WHEN** 使用者在 JetBrains Marketplace 瀏覽 spek plugin 頁面
- **THEN** 顯示 spek 品牌 icon 而非預設灰色方塊

### Requirement: Rich plugin description
`plugin.xml` 的 `<description>` SHALL 包含完整的 HTML 格式功能介紹，涵蓋功能列表與使用場景。

#### Scenario: Description content
- **WHEN** 使用者在 Marketplace 或 IDE plugin 安裝頁面檢視 spek
- **THEN** 描述包含以下內容：plugin 用途概述、主要功能列表（specs 瀏覽、changes 瀏覽、tasks 進度、graph 視覺化、搜尋）、支援的 IDE 範圍

#### Scenario: HTML formatting
- **WHEN** Marketplace 渲染 description
- **THEN** 內容以結構化 HTML 呈現（使用 `<ul>`、`<b>`、`<p>` 等標籤），非純文字

### Requirement: Change notes
`plugin.xml` SHALL 包含 `<change-notes>` 區塊，記錄當前版本的變更摘要。

#### Scenario: Change notes displayed
- **WHEN** 使用者在 Marketplace 或 IDE 中檢視 spek plugin 的 "What's New"
- **THEN** 顯示當前版本的變更項目列表

#### Scenario: Change notes updated on release
- **WHEN** 發佈新版本
- **THEN** `<change-notes>` 區塊 SHALL 包含該版本的變更摘要

### Requirement: Vendor information
Plugin 的 vendor 設定 SHALL 包含名稱與 URL，讓使用者能找到原始碼。

#### Scenario: Vendor URL in plugin.xml
- **WHEN** 讀取 `plugin.xml` 的 `<vendor>` 元素
- **THEN** 包含 `url` 屬性指向 GitHub repository

#### Scenario: Vendor in Gradle config
- **WHEN** 讀取 `build.gradle.kts` 的 vendor 設定
- **THEN** 包含 `name` 和 `url` 欄位

### Requirement: Plugin changelog
`packages/intellij/` 目錄下 SHALL 有獨立的 `CHANGELOG.md`，內容與 root `CHANGELOG.md` 及 `packages/vscode/CHANGELOG.md` 完全一致。

#### Scenario: CHANGELOG exists and synced
- **WHEN** 檢視 `packages/intellij/CHANGELOG.md`
- **THEN** 檔案存在且內容與 root `CHANGELOG.md` 完全一致

#### Scenario: CHANGELOG updated on release
- **WHEN** 執行 `/release` skill
- **THEN** 三份 CHANGELOG（root、vscode、intellij）同時更新且內容一致

### Requirement: Version synchronization
IntelliJ plugin 版號 SHALL 與主專案版號同步，透過 `npm version` 自動更新。

#### Scenario: npm version syncs gradle.properties
- **WHEN** 執行 `npm version <type>` 於 root 目錄
- **THEN** `packages/intellij/gradle.properties` 的 `pluginVersion` 自動更新為新版號

#### Scenario: All versions aligned
- **WHEN** release 完成後
- **THEN** root `package.json`、`packages/vscode/package.json`、`packages/intellij/gradle.properties` 三者版號一致

### Requirement: Release skill covers IntelliJ
`/release` skill SHALL 在 release 流程中處理 IntelliJ 相關的版號、CHANGELOG 和 change notes 更新。

#### Scenario: Release skill updates IntelliJ CHANGELOG
- **WHEN** 執行 `/release` skill 的 CHANGELOG 更新步驟
- **THEN** `packages/intellij/CHANGELOG.md` 與 root、vscode 同步更新

#### Scenario: Release skill push message
- **WHEN** release skill 顯示 push 確認訊息
- **THEN** 訊息 SHALL 提及 JetBrains Marketplace 發佈
