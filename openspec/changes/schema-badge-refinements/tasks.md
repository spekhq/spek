## 1. Core: expose defaultSchema (@spek/core)

- [x] 1.1 Add `defaultSchema: string | null` to `ScanResult` in `packages/core/src/types.ts` (flows into `AggregatedScanResult`), and to `ChangesData`, `ChangeDetail`, and `OverviewData`.
- [x] 1.2 Populate `ScanResult.defaultSchema` from `readRepoSchema(basePath)` at both return points in `scanner.ts` (single-scan + aggregated).
- [x] 1.3 Set `ChangeDetail.defaultSchema` in `readChange` via `readRepoSchema(repoDir)`.
- [x] 1.4 Add `@spek/core` unit tests asserting `defaultSchema` is populated on scan and that `ChangeDetail.defaultSchema` matches config.yaml independent of the change's own schema.

## 2. Forward defaultSchema through the response assemblers

- [x] 2.1 Web route `packages/web/server/routes/openspec.ts`: forward `scan.defaultSchema` on `/changes` and `/overview`.
- [x] 2.2 VS Code handler `packages/vscode/src/handler.ts`: forward `scan.defaultSchema` on getChanges and getOverview.
- [x] 2.3 Demo build `scripts/build-demo.ts`: include `defaultSchema` in the assembled `ChangesData` and `OverviewData`.

## 3. Shared React UI

- [x] 3.1 In `packages/web/src/components/SchemaBadge.tsx`, extract a presentational `SchemaPill` (always renders) and make `SchemaBadge` the hide-logic wrapper (nothing when `schema` falsy or `=== defaultSchema`) that composes `SchemaPill`.
- [x] 3.2 Replace the inline badge in `ChangeDetail.tsx` with `<SchemaBadge schema={data.schema} defaultSchema={data.defaultSchema} />`.
- [x] 3.3 Render `<SchemaBadge>` in `ChangeList.tsx` `ChangeRow`, beside `WorktreeBadge`, using `data.defaultSchema`.
- [x] 3.4 Render `<SchemaBadge>` in `Dashboard.tsx` active + recently-archived rows, beside `WorktreeBadge`.
- [x] 3.5 Show a `Default schema: <name>` subheading beneath the Specs page heading (`SpecList.tsx`), reusing `SchemaPill`, shown only when non-null.
- [x] 3.6 Add `useDefaultSchema()` to `hooks/useOpenSpec.ts`: module-scoped per-`repoPath` cache reading `OverviewData.defaultSchema`, synchronous on cache hit, re-fetched only on first load or `RefreshContext` bump (change detected). `SpecList` consumes it.
- [x] 3.7 Tests for `SchemaBadge` (hide predicate → null / SchemaPill) and `SchemaPill` (always renders, honours title).

## 4. IntelliJ Kotlin core parity

- [x] 4.1 Mirror `defaultSchema` on the Kotlin `ScanResult` / `ChangesData` / `ChangeDetail` / `OverviewData`, populated from the config.yaml read (`readRepoSchema` extracted in the scanner).
- [x] 4.2 Add/extend Kotlin unit tests asserting `defaultSchema` is populated, matching the TS core tests.

## 5. Verification

- [x] 5.1 `npm run type-check`, `npm run test -w @spek/core` (+ web tests), `npm run build` all green.
- [x] 5.2 IntelliJ Gradle `test` with freshly synced instrumented classes; confirm Kotlin test counts in the result XML.
- [ ] 5.3 Manually verify in `npm run dev`: badge hidden for default-schema changes on all surfaces, shown for a differing-schema change; Specs-page default-schema label renders and no longer flickers on repeat navigation.
- [x] 5.4 Quality gates: LSP references, unused-locals via tsc, reasoned mutation coverage of the badge predicate; clean source-only diff (no bundle/version noise).

## 6. Adversarial-review follow-ups

- [x] 6.1 Fix stale-cache-on-remount bug: key `useDefaultSchema`'s cache by `(repoPath, refreshKey)` so a `config.yaml` change detected while the Specs page is unmounted self-heals on the next visit. Extract the freshness decision into an exported pure function `resolveCachedDefaultSchema` and unit-test the hit / repo-switch / change-detected transitions.
- [x] 6.2 Lighten the hook's fetch to non-aggregated overview (`getOverview(false)`) — the repo default is worktree-independent.
- [x] 6.3 Make `ChangesData.defaultSchema` and `OverviewData.defaultSchema` required (not optional) so any assembler that forgets to forward `scan.defaultSchema` fails type-check (compile-time guard for the otherwise-untested overview wiring).
- [x] 6.4 Add a core test asserting `scanOpenSpecAggregated` carries the main worktree's `defaultSchema`.
- [x] 6.5 Document the aggregated cross-worktree baseline asymmetry and the Specs-header layout choice in design.md (known limitation / author-approved deviation, both to be surfaced in the PR).
