## Why

Change-detail artifact tabs are ordered by recency (newest mtime first), which is a good default but the only order available. Readers sometimes want the change's story order (schema-defined) or a predictable alphabetical order. A small "sort by" control lets each user pick, while keeping recency as the default. Because the shared React app renders on all three surfaces, one control serves web, VS Code, and IntelliJ.

## What Changes

- Add a **sort-by control** to the change-detail view with three options: **Last modified** (default, current behavior — mode id `modified`), **Schema order**, and **Alphabetical**. The choice is persisted globally in `localStorage` (`spek:artifact-sort`) so it applies to every change.
- **Last modified** and **Alphabetical** are pure client-side sorts derived from the artifacts already on the payload (`id` / `title`); no server involvement.
- **Schema order** reflects the schema's real `planningArtifacts` sequence, so it is correct for **custom schemas** (e.g. superpowers-bridge `brainstorm → proposal → plan → verify → retrospective`), not just spec-driven. This requires the order to come from OpenSpec:
  - Restore a cached CLI provider (`openspec status --change <slug> --json` → `actionContext.planningArtifacts` + `artifactPaths[id].outputPath`) and expose the resolved artifact-id sequence as a new `ChangeDetail.schemaOrder: string[] | null`, computed eagerly in `readChange`. **The default `artifacts` array stays mtime-ordered — unchanged — and directory scanning never calls the CLI.**
  - IntelliJ's Kotlin core gains the parity implementation.
- **Fallback with a clear signal**: when `schemaOrder` is null (the `openspec` CLI is not installed, or the change is archived so no `planningArtifacts` exist), "Schema order" degrades to the default `proposal → design → specs → tasks` then alphabetical order, and the UI shows an explicit, reason-specific caption ("OpenSpec CLI not available…" for active changes, "Schema order isn't tracked for archived changes…" for archived) plus a marker on the option — so the user always knows whether they are seeing the true schema order or an approximation.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `custom-schema-artifacts`: Add a requirement for **user-selectable artifact tab ordering** (recency default; schema-order and alphabetical alternatives; global persistence) and for surfacing the schema's authoritative order as `ChangeDetail.schemaOrder` with a transparent fallback when it is unavailable. The existing "Recency-based artifact ordering" requirement is unchanged — recency remains the default order of the `artifacts` array.

## Impact

- `packages/core/src/schema-order.ts` — restored (cached `cliSchemaOrderProvider` + `parseOrderFromStatus`), now producing an ordered artifact-id list rather than driving default order.
- `packages/core/src/scanner.ts` — `readChange` computes and attaches `schemaOrder`; `scanOpenSpec` untouched (no CLI).
- `packages/core/src/types.ts` — `ChangeDetail.schemaOrder?: string[]`.
- `packages/web/src/` — new pure `sortArtifacts` helper + unit test, a `useArtifactSort` localStorage hook, the sort control + fallback caption in `ChangeDetail.tsx`.
- API adapters (Fetch / Message / Static) and the demo build carry `schemaOrder` (part of `ChangeDetail`).
- `packages/intellij/` — restored `SchemaOrder.kt`, `ChangeReader` attaches `schemaOrder`; Kotlin tests.
- CHANGELOG synced across root / vscode / intellij.
