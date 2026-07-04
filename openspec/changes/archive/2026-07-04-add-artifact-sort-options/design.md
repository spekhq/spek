## Context

After `order-artifacts-by-recency`, `discoverArtifacts(changePath)` returns change-detail artifacts in mtime order (newest first) and `ChangeDetail.artifacts` is rendered as tabs by the shared `@spek/web` React app (`ChangeDetail.tsx`), which powers web, the VS Code webview, and the IntelliJ JCEF view. There is currently no way to change the order.

Users want alternatives: the schema's story order and a plain alphabetical order. Recency and alphabetical are derivable purely from data already on the payload (`id` / `title`). "Schema order", however, is intrinsically a schema concept — nothing on disk encodes it (mtime is recency; creation order breaks once `tasks` is edited). The only authoritative source is OpenSpec's `planningArtifacts`, obtained via the `openspec` CLI. So a correct schema order for *any* schema (including custom ones) requires reviving the CLI provider we removed — but now as a user opt-in, not the forced default.

## Goals / Non-Goals

**Goals:**
- A sort-by control offering Recency (default), Schema order, and Alphabetical, on all three surfaces via the shared app.
- Correct schema order for custom schemas, sourced from OpenSpec's authority.
- Recency stays the default; directory scanning stays CLI-free.
- Transparent, reason-specific fallback when schema order is unavailable.
- Global persistence of the user's choice.

**Non-Goals:**
- Manual drag-to-reorder / per-change custom orders (explicitly deferred).
- Changing the default order of `ChangeDetail.artifacts` (stays mtime).
- Cross-surface preference syncing (each surface has its own `localStorage` sandbox; "global" means across changes within a surface).
- Re-introducing the CLI into the scan/list/aggregation paths.

## Decisions

### Sort happens client-side over a payload that carries the schema order
Recency = the delivered array as-is; Alphabetical = sort by `title`; Schema order = sort by a new `ChangeDetail.schemaOrder: string[]` (artifact ids in schema sequence). A pure `sortArtifacts(artifacts, mode, schemaOrder)` helper (in `packages/web/src`) is unit-tested via the existing web test script. Keeping the sort in the frontend means the control and all three modes light up on every surface with no per-surface work.

### Schema order is resolved server-side, eagerly, and cached
`readChange` calls the restored cached `cliSchemaOrderProvider` (`openspec status --change <slug> --json`), maps each `artifactPaths[id].outputPath` to a discovered artifact id (the same literal/glob→specs mapping logic as before), and attaches the resulting id list as `schemaOrder` (or `null`).

**Why eager, not a lazy endpoint.** A lazy on-demand endpoint would keep even the detail view CLI-free until the user picks "Schema order", but costs a new endpoint + adapter method across Fetch/Message/Static. Eager attaches the data to the existing `ChangeDetail` payload — zero new endpoints, and the demo can bake it at build time. The perf concern that motivated removing the CLI was **scanning** (the list / multi-worktree aggregation touches many changes); a single-change detail view paying one cached spawn is acceptable. `scanOpenSpec` is deliberately left CLI-free.

### `schemaOrder` is data, not the default order
Restoring `schema-order.ts` does **not** restore schema-driven default ordering. `discoverArtifacts` is unchanged (mtime). The provider now only produces `schemaOrder` for the frontend to optionally sort by. This is the key difference from the pre-`order-artifacts-by-recency` design and why the un-deletion is safe.

### Transparent, reason-specific fallback
When `mode === "schema"` and `schemaOrder` is null, the frontend sorts by the hardcoded `proposal → design → specs → tasks` then alphabetical, and renders a caption between the sort control and the tabs, keyed off `ChangeDetail.status`:
- active + null → "OpenSpec CLI not available — showing default spec-driven order." (installing `openspec` fixes it)
- archived + null → "Schema order isn't tracked for archived changes — showing default order." (the CLI would not help, so we don't imply it)
The "Schema order" option also carries a small marker in the fallback state so it is discoverable before selection. When `schemaOrder` is present, no caption and no marker.

### Global persistence
`useArtifactSort()` reads/writes `localStorage["spek:artifact-sort"]` (`"modified" | "schema" | "alpha"`, where `modified` = last-modified/mtime order and is labeled "Last modified" in the UI), default `"modified"`, wrapped in try/catch so an absent/blocked `localStorage` silently falls back to the default. Verified to work in the VS Code webview and IntelliJ JCEF.

### IntelliJ parity
`SchemaOrder.kt` (`parseOrderFromStatus` + cached CLI provider) is restored; `ChangeReader` computes and attaches `schemaOrder` to its `ChangeDetail`. Kotlin unit tests cover parse + mapping.

## Risks / Trade-offs

- **Un-deleting `schema-order.ts` / `SchemaOrder.kt` so soon** → Justified by the changed rationale (opt-in data, not forced default) and documented here; the default path and scanning are provably unaffected.
- **Detail view spawns the CLI when installed** → One spawn per distinct change per process, cached; scanning (the hot path) is untouched. Acceptable.
- **Fallback order differs from a custom schema's true story when the CLI is absent** → Surfaced explicitly in the UI, so it is never silently misleading.
- **`localStorage` unavailable (rare embedding)** → try/catch degrades to the recency default; the control still works for the session.
- **Sort changes which tab opens by default** (first of the chosen sort) → Expected; explicit tab selection via the URL/hash still wins.

## Migration Plan

Additive. New optional `ChangeDetail.schemaOrder` field (older consumers ignore it); default behavior (recency tabs) is unchanged for users who never touch the control. Rollback is reverting the change. No data migration.

## Open Questions

None.
