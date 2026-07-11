## 1. Core scanner + types (`@spek/core`)

- [ ] 1.1 Add `defaultSchema: string | null` to the `ChangeInfo` interface in `packages/core/src/types.ts` (mirror the existing doc-comment style of `ChangeDetail.defaultSchema`).
- [ ] 1.2 Change `readChangeSchema(repoDir, changePath)` → `readChangeSchema(changePath, defaultSchema)` in `scanner.ts`: return the change-declared `schema:` or the passed `defaultSchema`; drop the internal `readRepoSchema(repoDir)` call and the now-unused `repoDir` param.
- [ ] 1.3 In `scanChangeDir`, add a `defaultSchema` parameter, use it for `schema: readChangeSchema(changePath, defaultSchema)`, and stamp `defaultSchema` onto the returned `ChangeInfo`.
- [ ] 1.4 In `scanOpenSpec`, compute `const defaultSchema = readRepoSchema(repoDir)` once and pass it to every `scanChangeDir(...)` call (active + archived); reuse the same value for `ScanResult.defaultSchema` instead of a second `readRepoSchema` call.
- [ ] 1.5 In `readChange`, compute `defaultSchema` once and pass it to `readChangeSchema` (removes the current double read of `config.yaml` at `scanner.ts:253-254`).
- [ ] 1.6 Confirm `scanOpenSpecAggregated` needs no change: each worktree scan already calls `scanOpenSpec` with its own `repoDir`, so each change now carries its own worktree's `defaultSchema`; `AggregatedScanResult.defaultSchema` stays `main.scan.defaultSchema`.

## 2. Core tests (`@spek/core`)

- [ ] 2.1 Add a `scanner.test.ts` case asserting each `ChangeInfo.defaultSchema` equals the repo default (and that a change declaring its own schema still reports that schema).
- [ ] 2.2 Add a test proving the read-once behavior: spy/count `config.yaml` reads (or use a fixture) so a scan of multiple undeclared-schema changes reads `config.yaml` once, not per change.
- [ ] 2.3 Add an aggregated-scan test with two worktrees whose `config.yaml` declare different schemas, asserting a no-schema change in the secondary worktree carries that worktree's default as `defaultSchema` (not the main worktree's).

## 3. Web API types + adapters

- [ ] 3.1 Ensure the web-facing `ChangeInfo` type carries `defaultSchema` (add the field, or confirm it re-exports from `@spek/core`) in `packages/web/src/api/types.ts` so the contract stays honest end-to-end.
- [ ] 3.2 Verify `FetchAdapter`, `MessageAdapter`, and `StaticAdapter` pass `ChangeInfo` objects through unchanged (they should require no code change); fix any explicit field mapping that would drop `defaultSchema`.

## 4. Web UI

- [ ] 4.1 `ChangeList.tsx:54` — change `<SchemaBadge schema={c.schema} defaultSchema={defaultSchema} />` to `defaultSchema={c.defaultSchema}` (per-change comparison).
- [ ] 4.2 `Dashboard.tsx:82` and `Dashboard.tsx:117` — same swap to `c.defaultSchema`.
- [ ] 4.3 Confirm `ChangeDetail.tsx:239` is already per-change (`data.defaultSchema`) and left untouched; confirm the Changes-page `Default schema:` header still reads `ChangesData.defaultSchema` (unchanged).

## 5. Kotlin core mirror (`spek-intellij`) — efficiency only

- [ ] 5.1 In `OpenSpecScanner.kt`, thread a once-computed `readRepoSchema(projectPath)` into `scanChangeDir` and into `readChangeSchema` (drop the per-change `readRepoSchema` fallback call at line 98), reusing it for `ScanResult.defaultSchema` at line 52.
- [ ] 5.2 Stamp `defaultSchema` onto the Kotlin `ChangeInfo` model (align with `@spek/core`); update `ChangeReader`/models as needed. Note: IntelliJ has no aggregation, so no per-change comparison change is needed in the UI.
- [ ] 5.3 Add/adjust a Kotlin unit test (`OpenSpecScannerTest.kt`) asserting `ChangeInfo.defaultSchema` is stamped and the fallback resolves from the once-read config.

## 6. Verification (quality gates)

- [ ] 6.1 `npm run type-check` clean across the monorepo.
- [ ] 6.2 `npm run test -w @spek/core` green (new scanner tests included).
- [ ] 6.3 `npm run build` (core + web) and `npm run build:demo` succeed; rebuilt `docs/demo.html` carries `defaultSchema` on changes.
- [ ] 6.4 IntelliJ: build + run Kotlin tests with freshly instrumented classes (verify the reported test count, not stale bytecode).
- [ ] 6.5 Run the project quality gates (mutation testing on changed scanner logic, LSP diagnostics, unused-export lint) before marking the change ready.
- [ ] 6.6 Exclude version bumps and CHANGELOG edits from this feature branch (integration-only, kept out of the upstream PR).
