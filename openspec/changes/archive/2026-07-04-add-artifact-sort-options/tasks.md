## 1. Core: schema order on the payload

- [x] 1.1 Restore `packages/core/src/schema-order.ts` — cached `cliSchemaOrderProvider` running `openspec status --change <slug> --json` plus pure `parseOrderFromStatus` (returns null on missing CLI / non-zero / archived / parse failure)
- [x] 1.2 Add a helper that maps the schema refs to discovered artifact ids (literal filename + `specs`-targeting glob/`spec.md` → `specs`), returning an ordered `string[]` or null
- [x] 1.3 Add `schemaOrder?: string[]` to `ChangeDetail` in `packages/core/src/types.ts`
- [x] 1.4 In `readChange` (`scanner.ts`), compute and attach `schemaOrder` (keep the `artifacts` array mtime-ordered; do NOT touch `scanOpenSpec`)
- [x] 1.5 Re-export the provider/parse helpers from `index.ts` as needed
- [x] 1.6 Unit tests: `parseOrderFromStatus` extraction + null cases; ref→id mapping (literal, specs glob, unmatched, missing file); `readChange` attaches `schemaOrder` and leaves `artifacts` in mtime order
- [x] 1.7 `npm run test -w @spek/core`, `npm run build:core`, `npm run type-check` — all green

## 2. Frontend: sort control + persistence

- [x] 2.1 Add a pure `sortArtifacts(artifacts, mode, schemaOrder)` helper (`recency` = as-is, `schema` = by `schemaOrder` with unmatched appended spec-driven-then-alpha, `alpha` = by title) in `packages/web/src`
- [x] 2.2 Unit test the helper (`*.test.ts`): each mode, unmatched-artifact handling, and null-`schemaOrder` fallback to `proposal→design→specs→tasks`+alpha
- [x] 2.3 Add `useArtifactSort()` reading/writing `localStorage["spek:artifact-sort"]` (default `recency`, try/catch guarded, global)
- [x] 2.4 In `ChangeDetail.tsx`, sort artifacts via `useMemo` before building tabs; add the sort control (Recency · Schema order · Alphabetical) to the header area, shown only when a change has ≥2 artifacts
- [x] 2.5 Add the reason-specific fallback caption + option marker when `mode === "schema"` and `schemaOrder` is null, keyed off `ChangeDetail.status` (active → CLI-missing message; archived → archived message)

## 3. Adapters and demo

- [x] 3.1 Confirm `schemaOrder` flows through `FetchAdapter`, `MessageAdapter`, and `StaticAdapter` (part of `ChangeDetail`); adjust any explicit `ChangeDetail` typing/serialization if needed
- [x] 3.2 Confirm the VS Code extension host response includes `schemaOrder` (it reuses `@spek/core` `readChange`)
- [x] 3.3 Rebuild the demo (`build:demo`) so `StaticAdapter` data includes `schemaOrder`; verify the demo still loads

## 4. IntelliJ Kotlin parity

- [x] 4.1 Restore `SchemaOrder.kt` (cached CLI provider + `parseOrderFromStatus`) in the Kotlin core
- [x] 4.2 In `ChangeReader`, compute the schema-order id list and add `schemaOrder` to the Kotlin `ChangeDetail` (and its serialization)
- [x] 4.3 Kotlin unit tests for parse + ref→id mapping; align existing tests
- [x] 4.4 `./gradlew test` (excluding the env-blocked `instrumentCode` if needed) — green

## 5. Verification and docs

- [x] 5.1 Run the web app: switch Recency / Schema order / Alphabetical on a change, confirm order changes, preference persists across changes, and (with the CLI uninstalled or on an archived change) the fallback caption shows the correct reason-specific message
- [x] 5.2 Update `CLAUDE.md`: document the `schemaOrder` field on `ChangeDetail`, the restored (opt-in, detail-view-only) CLI provider, and the sort control
- [x] 5.3 Sync the CHANGELOG entry across root `CHANGELOG.md`, `packages/vscode/CHANGELOG.md`, and `packages/intellij/CHANGELOG.md`
