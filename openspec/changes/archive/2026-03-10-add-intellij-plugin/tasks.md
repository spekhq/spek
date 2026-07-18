## 1. Project Setup

- [x] 1.1 Create `packages/intellij/` directory with Gradle project structure (build.gradle.kts, settings.gradle.kts, gradle.properties)
- [x] 1.2 Configure IntelliJ Platform Gradle Plugin with since-build 233, plugin id `com.spek.intellij`
- [x] 1.3 Create `plugin.xml` with extensions, actions, and Tool Window registration
- [x] 1.4 Add `build:intellij` npm script to root package.json for building frontend resources

## 2. Frontend Build Configuration

- [x] 2.1 Create Vite config for IntelliJ build (`vite.config.intellij.ts`) — IIFE output format, similar to webview build
- [x] 2.2 Create `main.intellij.tsx` entry point that initializes FetchAdapter with IntelliJ-specific base URL and dir parameter
- [x] 2.3 Create `IntellijApp.tsx` with MemoryRouter (similar to WebviewApp.tsx), reading project path from `window.__SPEK_PROJECT_PATH__`
- [x] 2.4 Create `index.intellij.html` template for JCEF loading
- [x] 2.5 Verify frontend build produces correct output in `packages/intellij/src/main/resources/webview/`

## 3. FetchAdapter Enhancement

- [x] 3.1 Add optional `baseUrl` parameter to FetchAdapter constructor for configurable API prefix
- [x] 3.2 Add optional `dirParam` parameter to FetchAdapter constructor for configurable directory query parameter name
- [x] 3.3 Update existing FetchAdapter usage in web version to ensure backward compatibility

## 4. Kotlin OpenSpec Scanner

- [x] 4.1 Create `OpenSpecScanner.kt` — scan `openspec/` directory structure, return specs and changes metadata
- [x] 4.2 Create `SpecReader.kt` — read individual spec content (spec.md, history entries)
- [x] 4.3 Create `ChangeReader.kt` — read individual change content (proposal.md, design.md, tasks.md, affected specs)
- [x] 4.4 Create `TaskParser.kt` — parse tasks.md checkbox format (`- [x]`/`- [ ]` + `##` sections)
- [x] 4.5 Create `SearchService.kt` — full-text substring search across specs and changes content
- [x] 4.6 Create `GraphBuilder.kt` — build spec-change relationship graph data
- [x] 4.7 Create data classes (OverviewData, SpecInfo, ChangeInfo, ChangeDetail, GraphData, etc.) matching TypeScript types

## 5. HTTP Request Handler

- [x] 5.1 Create `SpekHttpRequestHandler.kt` extending `HttpRequestHandler`, register in plugin.xml
- [x] 5.2 Implement route parsing for `/api/spek/openspec/*` endpoints
- [x] 5.3 Implement overview endpoint (`GET /api/spek/openspec/overview`)
- [x] 5.4 Implement specs list endpoint (`GET /api/spek/openspec/specs`)
- [x] 5.5 Implement spec detail endpoint (`GET /api/spek/openspec/specs/:topic`)
- [x] 5.6 Implement spec-at-change endpoint (`GET /api/spek/openspec/specs/:topic/at/:slug`)
- [x] 5.7 Implement changes list endpoint (`GET /api/spek/openspec/changes`)
- [x] 5.8 Implement change detail endpoint (`GET /api/spek/openspec/changes/:slug`)
- [x] 5.9 Implement graph endpoint (`GET /api/spek/openspec/graph`)
- [x] 5.10 Implement search endpoint (`GET /api/spek/openspec/search?q=...`)
- [x] 5.11 Implement static resource serving for frontend assets from plugin JAR resources
- [x] 5.12 Add CORS headers for JCEF cross-origin requests

## 6. Plugin Host & Tool Window

- [x] 6.1 Create `SpekPluginActivator.kt` — project detection logic (check openspec/config.yaml or openspec/specs/ + openspec/changes/)
- [x] 6.2 Create `SpekToolWindowFactory.kt` — Tool Window factory that creates JCEF webview
- [x] 6.3 Register "Open spek" action in Tools menu with keyboard shortcut

## 7. JCEF Webview Integration

- [x] 7.1 Create `SpekBrowserPanel.kt` — JCEF browser component setup and lifecycle management
- [x] 7.2 Implement project path injection (`window.__SPEK_PROJECT_PATH__`) via `executeJavaScript()`
- [x] 7.3 Implement theme detection and CSS class injection (dark/light)
- [x] 7.4 Implement theme change listener for runtime theme switching
- [x] 7.5 Implement file watcher for `openspec/` directory with 500ms debounce, triggering webview refresh
- [x] 7.6 Implement JCEF-not-available fallback message
- [x] 7.7 Implement navigation support (navigate to specific spec/change from IDE)

## 8. Build & Packaging

- [x] 8.1 Verify full build pipeline: `npm run build:intellij` → Gradle build → plugin JAR
- [x] 8.2 Test plugin installation in IntelliJ IDEA (local install from disk)
- [x] 8.3 Update root CLAUDE.md with IntelliJ plugin documentation
- [x] 8.4 Update root README.md with IntelliJ plugin usage instructions
