# Tasks

## 1. Core: the diagram root kind

- [x] 1.1 Add failing tests in `packages/core/src` for the new kind: `rootArtifacts` classifies a root `.mmd` and `.mermaid` as `diagram`, a subdirectory `.mmd` and a dotfile `.mmd` are not discovered, and `countArtifacts` counts a diagram file. Verify `npm test -w @spekjs/core` fails on exactly these.
- [x] 1.2 Add `DIAGRAM_EXTENSIONS = [".mmd", ".mermaid"]` and a `RootKind` `"diagram"` case in `packages/core/src/artifact-files.ts`, classified through the one `rootKind` classifier; export `DIAGRAM_EXTENSIONS` from `packages/core/src/index.ts` beside `DATA_EXTENSIONS`. Verify 1.1's tests pass.
- [x] 1.3 Add `"diagram"` to `ArtifactKind` in `packages/core/src/types.ts` and a `buildArtifact` case in `artifact-discovery.ts` that keeps the file's extension in the title (`flow.mmd`) and carries its raw text as `content`. Verify `npm run type-check` passes with no non-exhaustive-switch error.
- [x] 1.4 Confirm `changeDirMtime` and `listChangeArtifactFiles` pick up diagram files with no per-kind wiring, with a test that edits only a `.mmd` and asserts the change's mtime moves. Verify `npm test -w @spekjs/core` passes.
- [x] 1.5 Extend `packages/core/src/search-documents.test.ts` (or add a case) so a root `.mmd` contributes exactly one corpus document and the two corpus producers still agree document for document over this repository. Verify `npm test -w @spekjs/core` passes.
- [x] 1.6 Run `npm run build:core` so the web package imports the built copy of the new kind, per CLAUDE.md. Verify `packages/core/dist/artifact-files.d.ts` exports `DIAGRAM_EXTENSIONS`.

## 2. Watchers

- [x] 2.1 Derive `WATCHED_EXTENSIONS` in `packages/web/server/routes/openspec.ts` and `packages/vscode/src/watcher.ts` from `DIAGRAM_EXTENSIONS` alongside `DATA_EXTENSIONS`, with no re-listed literals. Verify by editing a `.mmd` in a test repo with `npm run dev` running and observing the live refresh.

## 3. Kotlin mirror (IntelliJ parity)

- [x] 3.1 Add the `DIAGRAM` enum member, `DIAGRAM_EXTENSIONS` and the `rootKind` case to `packages/intellij/src/main/kotlin/com/spek/intellij/core/ArtifactFiles.kt`, and the matching `when` branch in `ArtifactDiscovery.kt`. Verify `cd packages/intellij && ./gradlew test` compiles and passes (the `when` is exhaustive, so a missing branch fails the build).
- [x] 3.2 Add Kotlin tests mirroring 1.1 (root-only, dotfile-excluded, counted) and confirm `SearchService.kt` picks up diagram files through `ArtifactFiles`. Verify `./gradlew test` passes.
- [x] 3.3 Build the watched-extension set in `WatchPolling.kt` from the same source. Verify `./gradlew test` passes.

## 4. Diagram theme map

- [x] 4.1 Write `packages/web/src/utils/diagramTheme.ts` as a pure map from mermaid `themeVariables` key to `--color-*` token plus the floor that entry answers to (text 4.5:1 / graphic 3:1 / surface), with a per-entry fallback value and an explicit list of what mermaid would supply by default that is declared as owing nothing, with reasons (design D3).
- [x] 4.2 Add a unit test that every entry names a token `global.css` actually defines in both theme blocks. Verify `npm test -w @spekjs/web` fails before the map is complete and passes after.
- [x] 4.3 Extend `packages/web/src/**/contrast.test.ts` to import the map, resolve each token from both blocks of `global.css`, and measure it against its declared floor; add the map to the scan's stated enumeration of mechanisms. Verify `npm test -w @spekjs/web` passes and that removing an entry's declaration fails the test.

## 5. The diagram component

- [x] 5.1 Write failing tests for `MermaidDiagram` against a stubbed `mermaid` module covering each state: not-yet-visible, drawing, drawn, parse failure (reason plus source shown), load failure, source toggled and back, and redraw on theme change. Verify `npm test -w @spekjs/web` fails on exactly these.
- [x] 5.2 Implement `packages/web/src/components/MermaidDiagram.tsx`: one memoised `import("mermaid")`, `initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables })` from the map resolved via `getComputedStyle`, `render` keyed on `useId()`, output assigned into the container, `bindFunctions` deliberately not called (design D5). Verify 5.1's tests pass.
- [x] 5.3 Defer the first render to `IntersectionObserver`, falling back to immediate render where the API is absent, and redraw on theme change (design D4). Verify the not-yet-visible test passes and that a diagram inside a closed `<details>` draws at full size when the section is opened.
- [x] 5.4 Add the source toggle: shows the source verbatim and selectable, returns to the drawn form, and is reachable in the failure state too. Verify 5.1's toggle tests pass.
- [x] 5.5 Add zoom/pan: `overflow: hidden` container, CSS transform, wheel-with-modifier plus pointer drag, and explicit zoom-in / zoom-out / reset buttons (design D6). Verify the diagram's overflow is contained — a page holding an oversized diagram does not scroll horizontally at 400px width.

## 6. Markdown delegation

- [x] 6.1 Write `packages/web/src/utils/mermaidBlocks.ts` — the `rehypeSpekMermaid` plugin rewriting `pre > code` whose language is `mermaid` (matched case-insensitively) into the diagram element — with pure unit tests for: a mermaid fence is rewritten, another language is untouched, a language-less fence whose text begins `graph TD` is untouched. Verify `npm test -w @spekjs/web` passes.
- [x] 6.2 Register the plugin first in `MarkdownRenderer`'s `rehypePlugins`, ahead of `rehypeHighlightNarrow`, and map the produced element to `MermaidDiagram` in `components` (design D1). Add a test that a `mermaid` fence produces no `<pre>` and no `hljs` class, and that heading ids are unchanged by the plugin's presence. Verify `npm test -w @spekjs/web` passes.
- [x] 6.3 Add a test that a document with an unparseable diagram followed by headings and prose renders all of that content, and that a second, valid diagram in the same document still draws. Verify `npm test -w @spekjs/web` passes.

## 7. The diagram artifact tab

- [x] 7.1 Generalise `dataTabNames` in `packages/web/src/utils/dataArtifact.ts` to cover any kind whose title keeps an extension, add the `MERMAID` format entry, and keep `isMarkdownLike` false for `diagram` so no TOC is shown (design D8). Verify the existing tab-naming unit test plus a new `flow.md` / `flow.mmd` collision case pass.
- [x] 7.2 Add the `diagram` branch to `renderArtifact` in `packages/web/src/pages/ChangeDetail.tsx`, rendering `MermaidDiagram` with the artifact's content. Verify `npm run type-check` passes (`assertNever` fails to compile until the branch exists) and the tab shows a drawn diagram with no TOC.

## 8. Security and host verification

- [x] 8.1 Add a test that a diagram whose label text contains HTML or a `<script>` element produces no such markup in the container, confirming the strict security level is in force. Verify `npm test -w @spekjs/web` passes.
- [x] 8.2 Build the VS Code webview (`npm run build:webview`), package and run it, and verify a diagram shows its source with no error state and no CSP violation in the developer console. The drawing path is not exercised here — this build does not draw (design D2).
- [x] 8.3 Build the IntelliJ webview (`npm run build:intellij`) and verify the same in the tool window, remembering that `src/main/resources/webview/` is a build artifact and a stale one shows old UI.

## 9. Build exclusion and size

- [x] 9.1 Measure the cost before deciding: build the webview with and without the Mermaid import and record both figures. Verify the difference is captured (measured: 718,653 B → 5,952,548 B, +5.23 MB per single-file bundle; `docs/demo.html` would go 4.5 MB → ≈9.9 MB).
- [x] 9.2 Exclude Mermaid from the three single-file builds: `define: { __SPEK_DRAWS_DIAGRAMS__: "false" }` plus `resolve.alias` to a `export default null` stand-in in `vite.webview` / `vite.intellij` / `vite.demo`, and `"true"` in `vite.config.ts`. Verify the webview bundle returns to baseline (measured: 719,158 B, +505 over the no-Mermaid build).
- [x] 9.3 Give the diagram view a terminal `unavailable` state that shows the source without reporting an error and offers no switch to a drawing that does not exist. Verify `diagramState.test.ts`'s build-that-does-not-draw cases pass.
- [x] 9.4 Add `diagramBuilds.test.ts` asserting the flag and the alias across all four configs, and that the stand-in imports nothing. Verify it fails if either mechanism is removed.
- [x] 9.5 Verify the Web build still emits Mermaid as separate chunks and the app entry is unchanged (measured: entry 689 KB, `mermaid.core` 645 KB in its own chunk).
- [x] 9.6 Confirm `docs/demo.html` is untouched by this work — it is release-time, not archive-time, and `pages.yml` publishes what is committed verbatim. Verify `git status` shows no change to it.

## 10. Browser verification and gates

- [x] 10.1 Render a real diagram in the running Web app, in both themes, and confirm: it draws, the colours match the map's declared tokens, a diagram inside a closed `<details>` draws at full size when opened (5.3), and an oversized diagram does not make the page scroll sideways at 400px (5.5).
- [x] 10.2 Run the full gate set: `npm run type-check`, `npm run lint`, `npm test`, and `./gradlew test` in `packages/intellij`. Verify all pass.

## 11. Documentation

- [x] 11.1 Update `CLAUDE.md`: the new root kind in the core/artifact section, the D2 load-strategy decision with the measured sizes, and the diagram theme map in the palette-contrast discussion. Verify the file describes master's implementation after this change.
- [x] 11.2 Mark idea #2 done in `docs/feature-ideas.md`, in the style the other completed entries use.
- [x] 11.3 Note in the change's `proposal.md` Impact — already stated — that `@spekjs/core` is **minor, not patch**, so whoever cuts the release has it. Do not bump any version or write a CHANGELOG entry here.
