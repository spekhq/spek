## Context

`SpekBrowserPanel.<init>` throws `NoClassDefFoundError: com/intellij/ui/jcef/JBCefApp` on IntelliJ Platform 2026.2,
killing Tool Window content creation (issue #24).

What 2026.2 changed, read from branch `262` of `JetBrains/intellij-community`:

- JCEF now ships as a **bundled plugin** whose descriptor is `plugins/jcef/plugin/resources/META-INF/plugin.xml` and
  whose `<id>` is literally **`com.intellij.modules.jcef`** ("Web Browser (JCEF)"). It owns several content modules,
  each with its own classloader — `intellij.platform.ui.jcef` (providing `com.intellij.ui.jcef.*`) and
  `intellij.libraries.jcef` (providing `org.cef.*`) among them.
- Neither module existed as a separate unit before `262`: `platform/ui.jcef/resources/intellij.platform.ui.jcef.xml`
  404s on `261` and was added 2026-06-05, then folded into the bundled plugin on 2026-06-08.
- Our `plugin.xml` is a v1 descriptor declaring only `<depends>com.intellij.modules.platform</depends>`, so on 2026.2
  the plugin's classloader has neither module as a parent and cannot see `JBCefApp`.

The failure surfaces **at** the `JBCefApp.isSupported()` call — lazy constant-pool resolution of the `invokestatic`
inside `<init>` — not before it. Both available stack traces (spek `SpekBrowserPanel.kt:42` and the identical report
in `cline/cline#11830` at `ClineBrowserPanel.kt:20`) show this, and cline's log includes a `PluginClassLoader(...
parents=...)` dump that pins it as a classloader-visibility problem rather than a JCEF initialization failure. That
matters: the existing guard fails *inside itself*, so the `else` branch leading to the fallback is never reached.

Constraints that shape the design:

- **The plugin supports 2023.3+ (`pluginSinceBuild = 233`) and that range must not shrink.** Trading a broken Tool
  Window on 2026.2 for a plugin that will not load at all on 2023.3–2026.1 would be strictly worse.
- The platform provides an explicit backward-compatibility path for old-format plugins in exactly this situation
  (decision 1) — so "declare the dependency" and "keep 2023.3 working" are not in conflict, which an earlier reading
  of this problem wrongly assumed.
- **The two ends of the supported range are not equally verifiable.** The development machine has a working X11
  display, so the oldest supported build can be exercised for real via `runIde`. 2026.2 cannot: every 2026.2-capable
  IDE product requires an activated licence, which this change does not take on. For 2026.2 the available evidence is
  platform source, a shipped third-party precedent, and Plugin Verifier — which checks class resolution and does
  **not** exercise UI behavior. Claims about what a 2026.2 user *sees* therefore stay unverified here.
- `intellijIdeaCommunity(...)` cannot target 2026.2, but not for the reason first assumed: the `ideaIC` artifact does
  publish 2026.2 — it is the IntelliJ Platform Gradle Plugin that rejects it, with `validateVersion` throwing "IntelliJ
  IDEA Community (IC) is no longer published since 2025.3 (253), use `intellijIdea(...)`". The correct target is
  `intellijIdea("2026.2")`, which needs no licence for verification.

## Goals / Non-Goals

**Goals:**

- The Tool Window is constructible on every supported IDE build; no error from the embedded browser escapes it.
- **The embedded webview works again on 2026.2**, without raising `pluginSinceBuild` and without adopting an
  experimental plugin layout.
- When JCEF genuinely cannot be reached — for *any* reason — the user gets the external-browser fallback and the
  reason is written to the IDE log.
- CI can fail on this class of breakage in the future instead of it reaching Marketplace users silently.
- The supported IDE range stays 2023.3+, **demonstrated by running the modified plugin on a real 2023.3 IDE**, not
  only by the build passing.

**Non-Goals:**

- Converting spek to the modular-plugin format (`<content>` modules). JetBrains documents it as experimental, and
  decision 1 makes it unnecessary.
- A second Marketplace compatibility range.
- Raising `pluginSinceBuild`.
- Any change to the Web, VS Code, demo, or GitHub Action surfaces.

## Decisions

### 1. Depend on the JCEF plugin through a v1 **optional** plugin dependency

Add to the main descriptor:

```xml
<depends optional="true" config-file="spek-jcef.xml">com.intellij.modules.jcef</depends>
```

`spek-jcef.xml` mirrors the sub-descriptor shipped by the precedent plugin, verbatim rather than simplified:

```xml
<idea-plugin>
    <dependencies>
        <module name="intellij.platform.ui.jcef"/>
    </dependencies>
</idea-plugin>
```

Reading platform source suggests the inner block is a no-op — `IdeaPluginDescriptorImpl` sets a `depends`
sub-descriptor's `moduleDependencies` to `EMPTY` and reports `<dependencies><module>` there as an unexpected element —
which would mean the `<depends>` line alone does all the work. **We keep the block regardless, because the risk is
asymmetric:** if that reading is right, the cost is at most a log line; if it is wrong and we shipped an empty
descriptor, the fix silently does nothing on exactly the build we cannot observe from here. Copying a combination
known to work in the wild beats simplifying on the strength of an unverified source reading.

*Why this reaches the extracted modules:* `ModulesWithDependencies.collectDirectDependenciesInOldFormat` (branch
`262`) special-cases exactly this — when an old-format `<depends>` resolves to a plugin, **all of that plugin's content
modules** are added as classloader parents, with a comment naming old-format plugins that do not explicitly declare
the new extracted modules. Depending on the plugin id therefore yields both `intellij.platform.ui.jcef`
(`com.intellij.ui.jcef.*`) and `intellij.libraries.jcef` (`org.cef.*`) — and we need both, since the panel calls
`cefBrowser.executeJavaScript(...)`.

*Why it is safe below 2026.2:* the plugin id does not resolve there, and because the dependency is `optional` it is
not a strict dependency — `sequenceStrictDependencies` skips optional entries, so it cannot exclude the plugin from
loading. The sub-descriptor is simply not loaded.

*Alternatives:*

| Option | 2026.2 | 2023.3–2026.1 | Verdict |
|---|---|---|---|
| **v1 `<depends optional>` on the plugin id** | Embedded webview restored | Unaffected | **Chosen** |
| v2 `<dependencies><module>` in the main descriptor | Embedded restored | **Plugin does not load** | Rejected — `PluginSetBuilder` disables a main descriptor whose module dependency is unresolved |
| Modular plugin / optional content module | Embedded restored | Unknown | Rejected — experimental, and strictly more work than the chosen option |
| Two Marketplace compatibility ranges | Embedded restored | Stays on the old build | Rejected — reshapes the release process for no added benefit |
| Guard only, no dependency | External browser only | Unaffected | Insufficient alone — but see decision 2 |

*Evidence status:* this rests on reading platform source plus one shipped precedent.
`conan-io/conan-clion-plugin` — a v1-descriptor plugin in the same situation — added the identical `<depends
optional="true" config-file="withJcef.xml">com.intellij.modules.jcef</depends>` line in commit `ab66c80a`
(2026-07-20), described in its changelog as fixing a tool-window crash "on recent CLion versions where JCEF was split
into its own bundled module". Its fix is exactly this decision plus decision 2: the descriptor line, plus an
`isSupported()` guard making each JCEF panel nullable. It has **not** been run on a 2026.2 IDE here. The 2023.3 side,
which is the side that could regress existing users, *is* verified by running it (decision 6).

### 2. Keep a `Throwable`-based availability guard regardless

Decision 1 removes the cause we know about; it does not make the plugin immune to the next one. JCEF can also be
genuinely absent (unsupported runtime, JCEF disabled in the registry, a future re-layout of the platform), so
`JcefAvailability.isAvailable()` calls `JBCefApp.isSupported()` and returns `false` on **any `Throwable`**, logging the
reason at warning level.

`NoClassDefFoundError` is an `Error`, not an `Exception`, so `catch (e: Exception)` would not help; the catch must be
`Throwable` — "if we cannot even ask, the answer is no". `JBCefApp` may appear only in the invocation inside the method
body, never in a field type or signature, so the reference resolves when the call executes and the failure is
catchable there.

The probe is injectable (`isAvailable(probe: () -> Boolean = { JBCefApp.isSupported() })`) so a unit test can feed it a
probe that throws `NoClassDefFoundError` and assert the result is `false` — the issue #24 regression test, runnable
without an IDE.

### 3. Isolate JCEF types behind a JCEF-free interface — as hardening, not as the fix

`SpekBrowserPanel` holds a `SpekWebviewHost?` (component, load URL, execute JS, dispose — no JCEF type in any
signature). A new `JcefWebviewHost` is the only class naming `com.intellij.ui.jcef.*` **or `org.cef.*`**, instantiated
only after the guard passes.

**This is not load-bearing for the crash fix, and an earlier version of this design overstated it.** The claim was
that bytecode verification would force-load `JBCefBrowser` while linking the panel, making `try`/`catch` useless. That
is wrong here: the JVM treats an interface target as `java.lang.Object` for assignability, identical types are
trivially assignable, and field types and method descriptors are not eagerly resolved on their own. The observed
failures are at the `invokestatic`, which is catchable. The precedent plugin settles it empirically — its shipped fix
keeps `private val htmlPanel: JCEFHtmlPanel?` as a field type, guarding only the construction, and that is sufficient.
The isolation is worth doing for two honest reasons —
`JcefWebviewHost` can be faked in tests, and confining both JCEF packages to one class means a future extraction
degrades in one known place — but it is a quality improvement carrying regression risk, which is why decision 6
exists.

### 4. Plugin Verifier gate, with the compile target left alone

`pluginVerification.ides` gets an explicit list covering the oldest supported build and the newest released platform
build (`intellijIdea("2026.2")`); `verifyPlugin` runs in CI before publish. The **compile-time** platform stays
`intellijIdeaCommunity("2023.3.8")` — compiling against the oldest supported build keeps the API surface honest, and
JCEF is present there.

This likely requires upgrading the IntelliJ Platform Gradle Plugin (2.2.1 → current 2.18.1) to resolve 2026.x
artifacts at all. The upgrade is validated locally by `buildPlugin` + `test` still passing.

**Measured: Plugin Verifier does not report this failure, and cannot confirm the fix either.** Run against the
*unfixed* 1.9.0 build — the one that crashes on every 2026.2 Tool Window open — it printed
`Plugin tw.kewang.spek:1.9.0 against IU-262.8665.258: Compatible` and exited successfully. Verifier checks binary
compatibility: `com.intellij.ui.jcef.JBCefApp` **exists** in IU-262, merely in a classloader this plugin cannot reach,
and Verifier does not model plugin-classloader module visibility.

Two consequences, neither of which may be glossed over:

1. **The gate is blind to this entire class of breakage.** It is still worth adding — it catches genuine API removals
   and signature changes, which is not nothing — but it must not be described, in the CHANGELOG or anywhere else, as
   protection against a future module extraction. The compensating checks are the unit test on the guard (decision 2)
   and a run on a real IDE (decision 6).
2. **There is no automated way to confirm decision 1 works.** Verifier reports `Compatible` before and after the
   `<depends optional>` line, so it cannot distinguish a working fix from a broken one on 2026.2. The only evidence
   available for the 2026.2 side remains platform source, the conan precedent, and — after release — the issue #24
   reporter.

### 5. Fallback panel wording

The fallback stays as-is structurally — message, "Open in Browser" button, auto-open once the built-in server is
ready. Only the wording changes: it currently blames the IDE ("JCEF is not available in this IDE"), which was never
the whole story and is plainly wrong when the cause is the plugin's own dependency declaration.

### 6. Prove the 2023.3 end by running it, not by reasoning about it

Decisions 2 and 3 restructure code that runs on **every** IDE, including the ones that work today. That is this
change's real regression risk: 2026.2 is already broken and cannot get worse, whereas 2023.3–2026.1 currently work.
The worst outcome is a silent downgrade to the fallback panel on a JCEF-capable IDE — it compiles cleanly, passes
every unit test, and Verifier cannot see it.

So the acceptance evidence for those builds is an actual run: `runIde` against IDEA Community 2023.3.8 in a
Gradle-managed sandbox that leaves the developer's own IDE installation untouched, opening a project containing
`openspec/`, and confirming the Tool Window shows the **embedded** webview — not the fallback panel — with theme sync
and tree navigation intact.

Nothing equivalent is claimed for 2026.2; see the constraint in Context.

## Risks / Trade-offs

- **The `<depends optional>` route is unverified on a real 2026.2 IDE** → Mitigated by platform source and a shipped
  third-party precedent, and by the guard in decision 2: if the dependency does not resolve for some unforeseen
  reason, the plugin degrades to the external browser instead of crashing. The issue #24 reporter can confirm the
  embedded case on the released build.
- **The JCEF plugin id or its content-module layout could change again** → The guard keeps that a degradation rather
  than a crash, and the Verifier gate should surface it before release.
- **The isolation refactor could silently downgrade working IDEs to the fallback panel** → Caught by the 2023.3.8
  `runIde` check (decision 6); this is the one failure mode no automated check in this project can detect.
- **Plugin Verifier is confirmed blind to classloader-visibility gaps** → Measured, not feared (decision 4). The gate
  stays for what it does catch; the guard's unit test and the real-IDE run are the compensating checks. Nothing may
  claim the gate protects against a repeat of issue #24.
- **Upgrading the Gradle plugin 2.2.1 → 2.18.1 is a large jump and touches the publish path** → Validate locally with
  `buildPlugin` and `test`; a failed upgrade can be abandoned independently of the crash fix, which is what must ship.
- **A future platform release could extract another module we use** → The Verifier gate is the general mitigation;
  decisions 1–3 are the specific one.

## Migration Plan

1. Ship decisions 1–3 as a patch release, confirmed on 2023.3.8 by `runIde`.
2. Add the Verifier gate; if it fails against 2026.2 even after the fix for reasons beyond JCEF, fix or explicitly
   scope those findings before publishing.
3. Ask the issue #24 reporter to confirm on the released build — they are the only available 2026.2 observer, and the
   thing to confirm is specifically that the webview is **embedded**, not merely that the crash is gone.

Rollback: the change is confined to the IntelliJ package; reverting the commit restores current behavior (broken on
2026.2, fine elsewhere).

## Open Questions

- ~~Does Plugin Verifier report the missing `com.intellij.ui.jcef` visibility against 2026.2?~~ **Answered: no.** See
  decision 4.
- ~~Does the IntelliJ Platform Gradle Plugin need the full jump to 2.18.1?~~ **Answered: it cannot be used.** 2.14.0+
  requires Gradle 9, 2.11.0+ requires Gradle 8.13, and the wrapper is 8.11.1. Pinned at **2.9.0**, which is also the
  version that introduced the `intellijIdea(...)` helper the 2026.x target needs — so no wrapper upgrade is needed.
- Does `<depends optional>` on `com.intellij.modules.jcef` need a `sinceBuild` floor for `org.cef.*` visibility? A
  third-party plugin notes `intellij.libraries.jcef` became public in `262.8117`; that matters for the mandatory-module
  route, and should be confirmed as irrelevant for the optional route.
- The reporter's screenshot shows "1 of 3" errors; the other two are unknown and may be unrelated.
