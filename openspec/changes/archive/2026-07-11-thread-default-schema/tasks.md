## 1. Core scanner + types (`@spek/core`)

- [x] 1.1 Add `defaultSchema: string | null` to the `ChangeInfo` interface in `packages/core/src/types.ts` (mirror the existing doc-comment style of `ChangeDetail.defaultSchema`).
- [x] 1.2 Change `readChangeSchema(repoDir, changePath)` → `readChangeSchema(changePath, defaultSchema)` in `scanner.ts`: return the change-declared `schema:` or the passed `defaultSchema`; drop the internal `readRepoSchema(repoDir)` call and the now-unused `repoDir` param.
- [x] 1.3 In `scanChangeDir`, add a `defaultSchema` parameter, use it for `schema: readChangeSchema(changePath, defaultSchema)`, and stamp `defaultSchema` onto the returned `ChangeInfo`.
- [x] 1.4 In `scanOpenSpec`, compute `const defaultSchema = readRepoSchema(repoDir)` once and pass it to every `scanChangeDir(...)` call (active + archived); reuse the same value for `ScanResult.defaultSchema` instead of a second `readRepoSchema` call.
- [x] 1.5 In `readChange`, compute `defaultSchema` once and pass it to `readChangeSchema` (removes the current double read of `config.yaml` at `scanner.ts:253-254`).
- [x] 1.6 Confirm `scanOpenSpecAggregated` needs no change: each worktree scan already calls `scanOpenSpec` with its own `repoDir`, so each change now carries its own worktree's `defaultSchema`; `AggregatedScanResult.defaultSchema` stays `main.scan.defaultSchema`.

## 2. Core tests (`@spek/core`)

- [x] 2.1 Add a `scanner.test.ts` case asserting each `ChangeInfo.defaultSchema` equals the repo default (and that a change declaring its own schema still reports that schema).
- [x] 2.2 Add a test proving the read-once behavior: spy/count `config.yaml` reads (or use a fixture) so a scan of multiple undeclared-schema changes reads `config.yaml` once, not per change.
- [x] 2.3 Add an aggregated-scan test with two worktrees whose `config.yaml` declare different schemas, asserting a no-schema change in the secondary worktree carries that worktree's default as `defaultSchema` (not the main worktree's).

## 3. Web API types + adapters

- [x] 3.1 Ensure the web-facing `ChangeInfo` type carries `defaultSchema` (add the field, or confirm it re-exports from `@spek/core`) in `packages/web/src/api/types.ts` so the contract stays honest end-to-end.
- [x] 3.2 Verify `FetchAdapter`, `MessageAdapter`, and `StaticAdapter` pass `ChangeInfo` objects through unchanged (they should require no code change); fix any explicit field mapping that would drop `defaultSchema`.

## 4. Web UI

- [x] 4.1 `ChangeList.tsx:54` — change `<SchemaBadge schema={c.schema} defaultSchema={defaultSchema} />` to `defaultSchema={c.defaultSchema}` (per-change comparison).
- [x] 4.2 `Dashboard.tsx:82` and `Dashboard.tsx:117` — same swap to `c.defaultSchema`.
- [x] 4.3 Confirm `ChangeDetail.tsx:239` is already per-change (`data.defaultSchema`) and left untouched; confirm the Changes-page `Default schema:` header still reads `ChangesData.defaultSchema` (unchanged).

## 5. Kotlin core mirror (`spek-intellij`) — efficiency only

- [x] 5.1 In `OpenSpecScanner.kt`, thread a once-computed `readRepoSchema(projectPath)` into `scanChangeDir` and into `readChangeSchema` (drop the per-change `readRepoSchema` fallback call at line 98), reusing it for `ScanResult.defaultSchema` at line 52.
- [x] 5.2 Stamp `defaultSchema` onto the Kotlin `ChangeInfo` model (align with `@spek/core`); update `ChangeReader`/models as needed. Note: IntelliJ has no aggregation, so no per-change comparison change is needed in the UI.
- [x] 5.3 Add/adjust a Kotlin unit test (`OpenSpecScannerTest.kt`) asserting `ChangeInfo.defaultSchema` is stamped and the fallback resolves from the once-read config.

## 6. Verification (quality gates)

- [x] 6.1 `npm run type-check` clean across the monorepo.
- [x] 6.2 `npm run test -w @spek/core` green (new scanner tests included).
- [x] 6.3 `npm run build` (core + web) and `npm run build:demo` succeed; rebuilt `docs/demo.html` carries `defaultSchema` on changes.
- [x] 6.4 IntelliJ: build + run Kotlin tests with freshly instrumented classes (verify the reported test count, not stale bytecode).
- [x] 6.5 Run the project quality gates (mutation testing on changed scanner logic, LSP diagnostics, unused-export lint) before marking the change ready.
- [x] 6.6 Exclude **product** version bumps and the three product CHANGELOGs from this branch (integration-only). The `@spekjs/core` package version is a separate, independent version line (see §7) and *is* bumped here, as its public type changes in this change.

## 7. Review follow-ups: make the required field real across the API surface

- [x] 7.1 `packages/ui/src/timeline/__tests__/grouping.test.ts`: stamp `defaultSchema` in the `mkChange` fixture. The required field left this `ChangeInfo` literal type-invalid (`TS2741`) while the suite stayed green, because `packages/ui/tsconfig.json` excludes `__tests__` and the tests run through tsx without a typecheck.
- [x] 7.2 `packages/core/package.json`: bump `@spekjs/core` 1.0.0 → 1.1.0 (its own version line, independent of the product release).
- [x] 7.3 `packages/core/CHANGELOG.md`: document the source-breaking type change prominently — required `ChangeInfo.defaultSchema` breaks consumers that *construct* `ChangeInfo` (e.g. to feed `@spekjs/ui`'s `ChangeTimeline`), with a migration note and the reason it ships as a minor rather than a major (D7).
- [x] 7.4 `packages/intellij/.../core/Models.kt`: drop the `= null` defaults on `defaultSchema` for `ChangeInfo` / `ChangeDetail` / `ChangesData` so Kotlin gets the same compile-time guard as TS (D6). All three construction sites already pass a value.
- [x] 7.5 Re-verify after the follow-ups: `@spekjs/core`, `@spekjs/web`, `@spekjs/ui` and IntelliJ Kotlin suites green; `type-check` and `build` clean; the `TS2741` in the ui fixture gone.
