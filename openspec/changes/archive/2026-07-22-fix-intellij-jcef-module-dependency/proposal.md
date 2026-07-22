## Why

The IntelliJ plugin crashes on every Tool Window open in IDEs built on IntelliJ Platform 2026.2, throwing an
IDE Internal Error (`java.lang.NoClassDefFoundError: com/intellij/ui/jcef/JBCefApp` at `SpekBrowserPanel.<init>`)
and leaving the user with no viewer at all (issue #24, reported on WebStorm 2026.2, plugin 1.9.0). WebStorm 2026.2
went GA on 2026-07-16, so every 2026.2 user is hitting this now.

In platform branch `262`, JCEF ships as a bundled plugin with id **`com.intellij.modules.jcef`**, owning content
modules that each have their own classloader — `intellij.platform.ui.jcef` (`com.intellij.ui.jcef.*`) and
`intellij.libraries.jcef` (`org.cef.*`). Neither existed as a separate unit on `261`. Our `plugin.xml` is a v1
descriptor declaring only `<depends>com.intellij.modules.platform</depends>`, so the plugin's classloader has neither
module as a parent and cannot resolve `JBCefApp`. The same failure is reported against other plugins on 2026.2, with
classloader dumps confirming it is a visibility problem rather than a JCEF initialization failure.

Two failures compound the impact. The existing `JBCefApp.isSupported()` guard cannot protect anything, because it is
the guard's own call that fails to resolve — so the `else` branch leading to the external-browser fallback is never
reached, and a `catch (Exception)` would not help either, since `NoClassDefFoundError` is an `Error`. And nothing in
CI would ever have caught this: `pluginVerifier()` is declared as a dependency but never configured with target IDEs,
and `verifyPlugin` is not run by any workflow.

## What Changes

- **Declare a dependency on the JCEF plugin in a way that is backward compatible.** A v1
  `<depends optional="true" config-file="...">com.intellij.modules.jcef</depends>` makes the platform add that
  plugin's content modules as classloader parents on 2026.2, restoring the **embedded** webview, while remaining inert
  on builds where the id does not resolve — so the supported range stays 2023.3+ and `pluginSinceBuild` is untouched.
- **Make JCEF unavailability non-fatal in its own right.** Availability detection treats any `Throwable` (including
  `LinkageError` / `NoClassDefFoundError`) as "not available", logs the reason, and routes to the existing
  external-browser fallback. This is what makes the *next* platform change a degradation instead of a crash.
- **Confine JCEF types to one class.** `com.intellij.ui.jcef.*` and `org.cef.*` move behind a JCEF-free interface so
  the Tool Window panel names neither package, making the fallback path testable and future extractions survivable in
  a single known place.
- **Close the detection gap in CI.** Configure `pluginVerification.ides` and run `verifyPlugin` against both ends of
  the supported range, so a future platform extraction fails the build instead of reaching Marketplace users silently.

## Capabilities

### New Capabilities

- `intellij-platform-compatibility`: how the plugin declares its dependency on extracted platform modules, which
  declaration forms are permitted given the supported build range, and what evidence a compatibility-affecting change
  must produce before it is accepted.

### Modified Capabilities

- `intellij-external-browser-fallback`: "JCEF is not available" is broadened from "`JBCefApp.isSupported()` returned
  false" to include JCEF detection failing outright (missing class / link error), and the fallback is required to be
  reached in that case rather than the Tool Window construction failing.
- `intellij-plugin-host`: the Tool Window must be constructible on any supported IDE build regardless of whether JCEF
  is present, i.e. no exception may escape Tool Window content creation because of the embedded browser.
- `intellij-cicd`: the publish pipeline gains a Plugin Verifier gate over the supported IDE build range.

## Impact

- `packages/intellij/src/main/resources/META-INF/plugin.xml` — the optional dependency on `com.intellij.modules.jcef`,
  plus a new empty sub-descriptor file it points at.
- `packages/intellij/src/main/kotlin/com/spek/intellij/SpekBrowserPanel.kt` — JCEF and CEF references extracted, guard
  rewritten; new classes for the webview host and the availability check.
- `packages/intellij/build.gradle.kts` — Plugin Verifier configuration; likely an IntelliJ Platform Gradle Plugin
  upgrade (2.2.1 → current), and `intellijIdea(...)` rather than `intellijIdeaCommunity(...)` for the 2026.x
  verification target, which the Gradle plugin refuses to resolve under the Community coordinate.
- `.github/workflows/intellij-publish.yml` — `verifyPlugin` step.
- `packages/intellij/src/test/kotlin/...` — unit coverage for the availability guard.
- CHANGELOG (root + `packages/intellij`) — user-facing fix entry.
- No impact on the Web, VS Code, demo, or GitHub Action surfaces; `@spekjs/core` is untouched.
