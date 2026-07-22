## 1. Establish whether Plugin Verifier can even see this failure

- [x] 1.1 Upgrade the IntelliJ Platform Gradle Plugin from 2.2.1 to a version that can resolve 2026.x IDE artifacts; confirm `./gradlew buildPlugin` and `./gradlew test` still pass with the compile target unchanged at `intellijIdeaCommunity("2023.3.8")`
      - Landed on **2.9.0**, not the latest 2.18.1: 2.11.0+ requires Gradle 8.13+, 2.14.0+ requires Gradle 9.0+, and the wrapper is 8.11.1. 2.9.0 is the last version compatible with it — and is also the version that introduced the `intellijIdea(...)` helper needed for the 2026.x verification target, so no Gradle wrapper upgrade is required.
- [x] 1.2 Configure `intellijPlatform.pluginVerification.ides` with both ends of the supported range: the oldest supported build, and `intellijIdea("2026.2")` for the newest (the Gradle plugin's `validateVersion` refuses `intellijIdeaCommunity` at 2025.3+ and points at `intellijIdea(...)`)
      - Newest target lives in `gradle.properties` as `verifyLatestVersion`. Note for later: 2.9.0 deprecates the `ide(type, version)` form in favour of `create(type, version) { }` — worth switching so the next upgrade is clean.
- [x] 1.3 Run `./gradlew verifyPlugin` against the **unmodified** Kotlin sources and record verbatim whether it reports the missing `com.intellij.ui.jcef` / `org.cef` visibility on 2026.2
      - **Verifier does NOT report it.** Verbatim, against the crashing 1.9.0 build: `Plugin tw.kewang.spek:1.9.0 against IC-233.15619.7: Compatible` and `Plugin tw.kewang.spek:1.9.0 against IU-262.8665.258: Compatible`, `BUILD SUCCESSFUL`. Verifier checks binary compatibility — `com.intellij.ui.jcef.JBCefApp` *exists* in IU-262, just in a classloader this plugin cannot reach — and it does not model plugin-classloader module visibility.
- [x] 1.4 If 1.3 shows Verifier does not report it, record that limitation and the compensating check in `design.md` and the CHANGELOG entry instead of leaving the gate's coverage implied
      - Recorded in design decision 4. Consequence beyond the gate: Verifier also cannot *confirm the fix* — it reports Compatible either way — so task 2.3's original acceptance method is invalid and 2026.2 has no automated verification path at all.

## 2. Restore JCEF visibility on 2026.2

- [x] 2.1 Add `<depends optional="true" config-file="spek-jcef.xml">com.intellij.modules.jcef</depends>` to the main `plugin.xml`
- [x] 2.2 Add `spek-jcef.xml` containing `<idea-plugin><dependencies><module name="intellij.platform.ui.jcef"/></dependencies></idea-plugin>` — copied verbatim from the precedent plugin rather than simplified to an empty descriptor, because the reading that says the inner block is inert is unverified and getting it wrong fails silently on 2026.2
- [x] 2.3 ~~Confirm via `verifyPlugin` that both modules resolve~~ — **not possible**: task 1.3 proved Verifier reports `Compatible` either way, so it cannot distinguish a working fix from a broken one. Instead: diff the descriptor against the conan precedent line by line, and record in the change that the 2026.2 side ships unverified, resting on platform source plus that precedent
- [x] 2.4 Confirm `verifyPlugin` against the oldest supported build still passes — this does *not* prove classloader behavior, only that the added descriptor is well-formed and breaks nothing binary; the real check for that end is task 6
      - `Plugin tw.kewang.spek:1.9.0 against IC-233.15619.7: Compatible` with the optional dependency declared — the added descriptor is well-formed and breaks nothing.

## 3. Make unavailability a degradation rather than a crash

- [x] 3.1 Add `JcefAvailability.isAvailable(probe: () -> Boolean = { JBCefApp.isSupported() })` returning `false` on any `Throwable` and logging the reason at warning level; `JBCefApp` may appear only inside the method body, never in a field type or signature
- [x] 3.2 Add a `SpekWebviewHost` interface (component, load URL, execute JavaScript, dispose) whose signatures name neither `com.intellij.ui.jcef` nor `org.cef`
- [x] 3.3 Add `JcefWebviewHost` implementing it — the only class naming either package — owning the `JBCefBrowser`, its `Disposer` registration, the `LafManagerListener` theme sync, and every `cefBrowser.executeJavaScript` call
- [x] 3.4 Change `SpekBrowserPanel` to hold `SpekWebviewHost?`, construct `JcefWebviewHost` only after `JcefAvailability.isAvailable()` passes, and remove every `com.intellij.ui.jcef` and `org.cef` import, field type, and method signature from the panel
- [x] 3.5 Verify the fallback path still auto-opens the external browser once the built-in server is ready, and that `navigateTo` in fallback mode opens the URL with the route as a `#` fragment
      - Exercised for real on IC-2023.3.8 by temporarily making the default probe throw `NoClassDefFoundError` — the same exception, from the same place, as issue #24. Result: `WARN ... JCEF is unavailable`, **0 ERROR**, the Swing fallback panel, and the external browser opened automatically. Confirms the guard converts the exact crash from issue #24 into a degradation.
- [x] 3.6 Reword the fallback panel message so it does not attribute the cause to the IDE's runtime (the cause can equally be the plugin's own missing dependency)

## 4. Tests

- [x] 4.1 Add `JcefAvailabilityTest`: a probe throwing `NoClassDefFoundError` yields `false` (the issue #24 regression), a probe throwing another `Throwable` yields `false`, and a probe returning `true`/`false` passes through unchanged
- [x] 4.2 Add a check that `SpekBrowserPanel`'s compiled class references neither `com/intellij/ui/jcef` nor `org/cef` — scanning the compiled `.class` bytes is enough and needs no IDE. If it proves brittle, drop it and say so rather than weakening it into a no-op
- [x] 4.3 Run `./gradlew test` and confirm the existing Kotlin unit tests still pass

## 5. CI gate

- [x] 5.1 Add a `verifyPlugin` step to `.github/workflows/intellij-publish.yml` that runs before the publish step and fails the workflow on verification problems
- [x] 5.2 Confirm `verifyPlugin` passes against every configured IDE build with the fix applied; investigate and either fix or explicitly scope any finding unrelated to JCEF before it is left in place
      - Both targets `Compatible`, `BUILD SUCCESSFUL`, no findings to scope. Worth restating: this result is identical to the one the **crashing** build produced (task 1.3), so it is evidence of "nothing binary broken", not evidence the 2026.2 fix works.

## 6. Manual verification on the oldest supported build

- [x] 6.1 Launch `./gradlew runIde` against IDEA Community 2023.3.8 in the Gradle sandbox and open a project containing `openspec/`
- [x] 6.2 Confirm the Tool Window shows the **embedded** webview and not the fallback panel, and that theme switching and tree-driven navigation still drive the embedded webview
- [x] 6.3 Record the outcome in the change; if the panel falls back on a JCEF-capable IDE, treat it as a blocking regression, not a cosmetic issue
      - **Passed on IC-2023.3.8.** `Loaded custom plugins: spek - OpenSpec Viewer (1.9.0)`, 0 ERROR / 0 NoClassDefFoundError in `idea.log`. The Tool Window rendered the embedded React webview (Overview dashboard with live counts), not the Swing fallback. JCEF genuinely initialised: `JBCefApp - JCEF-sandbox is enabled`, `jcef version: 111.2.1.691`. This also settles the open question about the optional dependency: with the `<depends optional="true">com.intellij.modules.jcef</depends>` line present, a build that has no such plugin id loads the plugin normally — the declaration is inert there, exactly as the platform source predicted.

## 7. Documentation

- [x] 7.1 Add a short section to `CLAUDE.md` on platform content-module extraction: the plugin's classloader can lose access to a platform package across IDE versions, a v1 `<depends optional>` on the owning plugin id is the backward-compatible way to regain it, mandatory v2 module dependencies are unsatisfiable below the extraction point, and the supported range is 2023.3+
