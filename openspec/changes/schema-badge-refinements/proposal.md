## Why

The schema badge added in #6 renders only on the Change Detail page, so you can't tell a change's schema at a glance from the Changes list or Dashboard — yet spotting a differently-shaped change in a mixed-schema repo is exactly a *list*-level need. At the same time, in a single-schema repo every change carries an identical badge, which is pure noise. Issue #9 asks for two refinements so the badge earns its keep: show it where scanning happens, and hide it when it is just the repo default.

## What Changes

- Extract the inline schema badge from `ChangeDetail` into a reusable `SchemaBadge` component and render it in the Changes list rows and the Dashboard change rows (beside the existing `WorktreeBadge`), not only on Change Detail.
- Hide the badge whenever a change's schema equals the repo's **default** schema (read from `openspec/config.yaml`, no CLI), rather than hardcoding `spec-driven`. This de-noises any single-schema repo, including one whose default is a custom schema, while a change authored under a different schema still stands out. The hide rule is applied uniformly, including the Change Detail header.
- Expose the repo default schema to the frontend as a new `defaultSchema` field on `ScanResult` / `ChangesData` / `ChangeDetail` (mirrored in the IntelliJ Kotlin core), so the hide comparison and the label below have data to work with. No new API endpoint.
- Surface a quiet `Default schema: <name>` label on the Overview/Dashboard header (only when a default is known), so the suppressed-default baseline stays legible — otherwise a badge-less list is ambiguous about what schema everything shares.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `custom-schema-artifacts`: the "Surface the schema name per change" requirement expands — the schema badge is shown on change *list* and *overview* surfaces (not only Change Detail), is hidden when a change's schema equals the repo default, the repo default schema is exposed to views via `defaultSchema`, and the Overview surface displays that default.

## Impact

- **`@spek/core`**: add `defaultSchema` to `ScanResult` (flows into `AggregatedScanResult`) and `ChangeDetail`; add to the `ChangesData` shape assembled by callers. Populated from the existing `readRepoSchema()` (config.yaml `schema:`), no CLI, off the scan hot path.
- **Types**: `ChangesData.defaultSchema`, `ChangeDetail.defaultSchema`.
- **Callers of the changes response**: web route (`packages/web/server/routes/openspec.ts`), VS Code handler (`packages/vscode/src/handler.ts`), demo build (`scripts/build-demo.ts`) forward `scan.defaultSchema`.
- **Shared React UI** (covers Web / VS Code / IntelliJ): new `SchemaBadge` component; used in `ChangeDetail`, `ChangeList`, `Dashboard`; new default-schema label on `Dashboard`.
- **IntelliJ Kotlin core**: mirror the `defaultSchema` field on its `ChangesData` / `ChangeDetail` equivalents (it already reads `config.yaml`).
- Additive only; no version bumps; no breaking changes.
