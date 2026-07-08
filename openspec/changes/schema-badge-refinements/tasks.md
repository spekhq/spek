## 1. Core: expose defaultSchema (@spek/core)

- [x] 1.1 Add `defaultSchema: string | null` to `ScanResult` in `packages/core/src/types.ts` (flows into `AggregatedScanResult`), to `ChangeDetail`, and to `ChangesData` (required).
- [x] 1.2 Populate `ScanResult.defaultSchema` from `readRepoSchema(basePath)` at both return points in `scanner.ts` (single-scan + aggregated).
- [x] 1.3 Set `ChangeDetail.defaultSchema` in `readChange` via `readRepoSchema(repoDir)`.
- [x] 1.4 Add `@spek/core` unit tests: `defaultSchema` on single scan, aggregated scan, null when no config.yaml, and `ChangeDetail.defaultSchema` independent of the change's own schema.

## 2. Forward defaultSchema through the changes-response assemblers

- [x] 2.1 Web route `packages/web/server/routes/openspec.ts` `/changes`: forward `scan.defaultSchema`.
- [x] 2.2 VS Code handler `packages/vscode/src/handler.ts` getChanges: forward `scan.defaultSchema`.
- [x] 2.3 Demo build `scripts/build-demo.ts`: include `defaultSchema` in the assembled `ChangesData`.

## 3. Shared React UI

- [x] 3.1 In `packages/web/src/components/SchemaBadge.tsx`, add a presentational `SchemaPill` (always renders) and make `SchemaBadge` the hide-logic wrapper (nothing when `schema` falsy or `=== defaultSchema`) that composes `SchemaPill`.
- [x] 3.2 Replace the inline badge in `ChangeDetail.tsx` with `<SchemaBadge schema={data.schema} defaultSchema={data.defaultSchema} />`.
- [x] 3.3 Render `<SchemaBadge>` in `ChangeList.tsx` `ChangeRow`, beside `WorktreeBadge`, using `data.defaultSchema`.
- [x] 3.4 Render `<SchemaBadge>` in `Dashboard.tsx` active + recently-archived rows, beside `WorktreeBadge`.
- [x] 3.5 Show a `Default schema: <name>` subheading beneath the Changes page heading (`ChangeList.tsx`), reusing `SchemaPill`, fed by `ChangesData.defaultSchema` (already fetched — no extra request), shown only when non-null. Additive to the header (no relocation of existing elements).
- [x] 3.6 Tests for `SchemaBadge` (hide predicate → null / SchemaPill) and `SchemaPill` (always renders, honours title).

## 4. IntelliJ Kotlin core parity

- [x] 4.1 Mirror `defaultSchema` on the Kotlin `ScanResult` / `ChangesData` / `ChangeDetail`, populated from the config.yaml read (`readRepoSchema` extracted in the scanner).
- [x] 4.2 Kotlin unit tests asserting `defaultSchema` is populated, matching the TS core tests.

## 5. Verification

- [x] 5.1 `npm run type-check`, `npm run test -w @spek/core` (+ web tests), `npm run build` all green.
- [x] 5.2 IntelliJ Gradle `test` with freshly synced instrumented classes; confirm Kotlin test counts in the result XML.
- [ ] 5.3 Manually verify in `npm run dev`: badge hidden for default-schema changes on all surfaces, shown for a differing-schema change; Changes-page default-schema subheading renders with the list.
- [x] 5.4 Quality gates: LSP references, unused-locals via tsc, reasoned mutation coverage of the badge predicate; clean source-only diff (no bundle/version noise).

## 6. Adversarial-review follow-ups

- [x] 6.1 Make `ChangesData.defaultSchema` required (not optional) so any assembler that forgets to forward `scan.defaultSchema` fails type-check (compile-time guard for the changes-response wiring).
- [x] 6.2 Add a core test asserting `scanOpenSpecAggregated` carries the main worktree's `defaultSchema`.
- [x] 6.3 Document the aggregated cross-worktree baseline asymmetry in design.md (known limitation; the Changes-page label and its row badges read the same `ChangesData.defaultSchema`, so they stay mutually consistent).
- [x] 6.4 Simplification (post-review, per issue re-read): moved the default-schema label from the Specs page to the Changes page and sourced it from `ChangesData.defaultSchema`, removing the `useDefaultSchema` cache hook, the `OverviewData.defaultSchema` plumbing, and the Specs-header change entirely.
