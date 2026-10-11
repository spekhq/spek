# Tasks

## 1. TypeScript core and shared fixture

- [x] 1.1 Add a shared fixture at `test-fixtures/nested-specs/` (read by both the TypeScript and Kotlin tests) with flat, parent, child, and same-basename specs, a root `specs/spec.md`, and active and archived nested deltas; verify the fixture is exercised by core scanner tests. Symlink cases are created at test runtime in a temp dir, not committed (git symlinks depend on `core.symlinks`, and creating them on Windows needs Developer Mode — skip with a stated reason when creation fails).
- [x] 1.2 Make main spec scanning, delta discovery, artifact count/mtime, graph input (both `buildGraphData` and `buildGraphDataAggregated`), aggregated history counts, and search-document collection use one recursive walker implementing OpenSpec's `discoverSpecFiles` rule, ordered by code unit; verify core tests cover the fixture, the symlink and root-`spec.md` cases, and preserve flat-topic results. Run `npm run build:core` before any web test, since web imports core's `dist/`.
- [x] 1.3 Add an exported topic-path validator and apply it, with version-slug validation, to every core read, then match related changes by exact full topic; verify tests reject traversal, a trailing newline, and symlink escape, refuse topics discovery would not list (a `.`-prefixed segment, a path through a symlinked directory), and separate parent, child, and same-basename histories.
- [x] 1.4 Add a pure tree projection on a browser-safe `@spekjs/core` subpath that supports a spec-bearing parent and grouping-only folders, sorted per segment by code unit; verify focused tests for ordering (`a`, `a-b`, `a/c`, `ab`), duplicate basenames, and that the subpath imports no Node-only module.

## 2. Web API and shared web UI

- [x] 2.1 Add query-selected spec detail/version responses to the Express API and `FetchAdapter`, retaining flat routes with the same validation; verify route tests cover list, nested detail/version, 400 malformed selectors (including an encoded `..%2F` topic on the legacy route), and 404 missing content.
- [x] 2.2 Use `/specs/*` in every React entry point and a shared per-segment spec URL builder at all link sources; verify route/link tests cover nested direct loading, refresh, reserved characters, flat URLs, and heading hashes.
- [x] 2.3 Render the Specs page as a filterable folder tree with openable spec-bearing parents; verify component tests cover parent/child, grouping-only folders, duplicate basenames, and filtering by full path.
- [x] 2.4 Preserve full topics in change Specs headers and TOC anchors, proposal inline links, search results, graph nodes (last-segment label rendered by `SpecGraph`, full-topic tooltip, click reporting the topic from the node id via a new core `specNodeTopic`), and version comparisons; verify focused tests navigate to the exact nested topic, that two same-basename graph nodes each open their own topic, and that nested deltas stay out of search.

## 3. VS Code sidebar

- [x] 3.1 Project the shared spec tree into VS Code TreeItems, listing a spec-bearing parent's child topics before its own headings and retaining heading navigation; verify a provider test covers expansion order and full-topic heading URLs, and `npm run build:vscode` succeeds.

## 4. IntelliJ host

- [x] 4.1 Make Kotlin main and delta discovery recursive by the same OpenSpec rule and code-unit order, including count/mtime, search, and graph inputs; verify Kotlin tests against `test-fixtures/nested-specs/` and confirm TypeScript/Kotlin topic parity.
- [x] 4.2 Add a Kotlin mirror of the topic validator (`\A`/`\z` anchors) and apply it with slug validation to detail, history, and version reads; verify tests for exact parent/child history, malformed paths, a trailing newline, symlink escape, and topics discovery would not list.
- [x] 4.3 Add query-selected detail/version handling to the IntelliJ HTTP server while retaining flat routes with the same validation; confirm how `QueryStringDecoder.path()` treats `%2F`; verify route tests cover list, nested 200, malformed 400, and missing 404 responses.
- [x] 4.4 Render nested IntelliJ tree nodes, sorted per segment by code unit, with openable spec-bearing parents, non-navigating grouping nodes, full-topic tooltips, and full-topic navigation; verify tree model/navigation tests.

## 5. Cross-surface integration

- [x] 5.1 Exercise the shared fixture through the web, VS Code, IntelliJ, and static adapters to verify the same nested topic IDs, search results, history, and graph edges across surfaces.
- [x] 5.2 Run `npm test`, `npm run type-check`, `npm run lint`, the relevant builds, the Gradle `test` task from `packages/intellij`, and `openspec validate support-nested-spec-folders --strict`; verify every command passes and review the final diff for scope.
