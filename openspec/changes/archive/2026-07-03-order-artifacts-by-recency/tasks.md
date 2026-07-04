## 1. Core: recency ordering

- [x] 1.1 In `packages/core/src/artifacts.ts`, capture each root `*.md` artifact's `mtimeMs` (via `statSync`) while discovering it, and compute the `specs` artifact's timestamp as the max `mtimeMs` over its `specs/**/spec.md` delta files
- [x] 1.2 Replace the CLI-order block with a sort by `mtimeMs` descending, reusing the existing `proposal, design, specs, tasks`-then-alphabetical comparator as the equal-mtime tiebreak
- [x] 1.3 Change `discoverArtifacts` signature to `discoverArtifacts(changePath)` — remove the `repoRoot`, `slug`, and `orderProvider` parameters and the `keyForOutputPath` helper
- [x] 1.4 Update the call site in `packages/core/src/scanner.ts` to `discoverArtifacts(changePath)`
- [x] 1.5 Delete `packages/core/src/schema-order.ts` and remove any remaining imports/exports of it

## 2. Core: tests

- [x] 2.1 Delete the `schema-order` unit test(s)
- [x] 2.2 Rewrite the `artifacts` tests: newest-mtime-first ordering, `specs` uses newest delta mtime, equal-mtime falls back to the stable default order, custom-schema artifacts ordered without any CLI call, humanized titles preserved
- [x] 2.3 Run `npm run test -w @spek/core` and `npm run type-check` — both green

## 3. IntelliJ Kotlin parity

- [x] 3.1 Update `ArtifactDiscovery.kt` to sort by file modification time (newest first) with the same stable narrative-order tiebreak
- [x] 3.2 Remove the ordering role of `SchemaResolver.kt` (delete it if it has no other use) and drop the schema-order call from discovery
- [x] 3.3 Align the Kotlin unit tests in `src/test/kotlin` with the new ordering behavior
- [x] 3.4 Build the plugin (`./gradlew buildPlugin`) / run Kotlin tests — green

## 4. Verification and docs

- [x] 4.1 Run the web app and open a change; confirm the most recently edited artifact tab leads and a freshly-checked-out change shows the stable narrative order
- [x] 4.2 Update `CLAUDE.md` where it describes CLI-delegated artifact ordering / `schema-order.ts`, to describe recency ordering instead
- [x] 4.3 Sync the CHANGELOG entry across root `CHANGELOG.md`, `packages/vscode/CHANGELOG.md`, and `packages/intellij/CHANGELOG.md`
