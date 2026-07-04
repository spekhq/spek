## Why

Change-detail tabs are ordered by the authoritative schema order obtained from the `openspec` CLI, which pins `tasks` last for every schema. During a superpowers-bridge run the `tasks` list is the living document — continuously edited as the plan executes — yet it stays buried in the last tab. Ordering by recency instead surfaces whatever artifact is actively being worked on, is schema-agnostic, and lets us delete the whole CLI-spawn / schema-order subsystem.

## What Changes

- Change-detail artifacts are ordered by **filesystem mtime, newest first**, instead of by the OpenSpec CLI's authoritative schema order.
- The `specs` artifact's sort timestamp is the newest mtime among its `specs/**/spec.md` delta files.
- Equal mtimes (e.g. a fresh `git clone`/`checkout` where every file shares the checkout time) fall back to the existing stable tiebreak: the `proposal, design, specs, tasks` order first, then alphabetical — so a just-cloned repo still shows the familiar narrative order.
- **BREAKING (internal API)**: `discoverArtifacts` drops its `slug` and `orderProvider` parameters. The `schema-order.ts` module (`cliSchemaOrderProvider`, `parseOrderFromStatus`) and the `keyForOutputPath` glob-matching helper are deleted. No more `openspec status` subprocess is spawned during a scan.
- The IntelliJ Kotlin port is aligned: its schema-order resolver is removed and artifact discovery sorts by mtime with the same tiebreak.
- Schema *awareness* is unchanged: the schema name is still read from `.openspec.yaml` (falling back to `openspec/config.yaml`) and displayed. Only schema-based *ordering* is removed.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `custom-schema-artifacts`: The "Authoritative artifact ordering delegated to OpenSpec" requirement is replaced by a "Recency-based artifact ordering" requirement — order is determined by filesystem mtime (newest first) with a stable narrative-order tiebreak, and spek no longer calls the OpenSpec CLI to order artifacts. All other requirements in this capability (filesystem-driven discovery, kind classification, schema-name surfacing, the ChangeDetail artifacts contract, and cross-surface parity) are unchanged.

## Impact

- `packages/core/src/artifacts.ts` — recency sort replaces the CLI-order block; `keyForOutputPath` removed.
- `packages/core/src/schema-order.ts` — deleted (plus its unit test).
- `packages/core/src/scanner.ts` — `discoverArtifacts(repoRoot, changePath)` call simplified.
- `packages/core/test/` — artifacts tests rewritten around mtime ordering; schema-order tests removed.
- `packages/intellij/src/main/kotlin/com/spek/intellij/core/` — `ArtifactDiscovery.kt` sorts by mtime; `SchemaResolver.kt` (ordering role) removed; Kotlin tests aligned.
- No public HTTP API shape change: `ChangeDetail.artifacts` still ships an ordered array; only the ordering rule changes.
- CHANGELOG (root, vscode, intellij) synced.
