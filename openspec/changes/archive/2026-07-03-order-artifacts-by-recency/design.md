## Context

`discoverArtifacts` (`packages/core/src/artifacts.ts`) builds the change-detail tabs from the files on disk, then orders them by asking the OpenSpec CLI for the authoritative schema order: `cliSchemaOrderProvider` shells out to `openspec status --change <slug> --json` and reads `actionContext.planningArtifacts`. When the CLI can't answer, it falls back to a fixed `["proposal","design","specs","tasks"]` order then alphabetical.

Both the schema order and the fallback pin `tasks` last. For the superpowers-bridge schema this is actively wrong: `tasks.md` is the living execution document, edited continuously (and often uncommitted) while the plan runs, yet it sits in the last tab. The user wants the actively-worked artifact surfaced first.

## Goals / Non-Goals

**Goals:**
- Order change-detail artifacts by recency — most recently modified first — so the artifact currently being worked on leads.
- Be schema-agnostic: no dependency on a schema definition, the OpenSpec CLI, or per-schema knowledge.
- Remain deterministic and non-random for repos the viewer did not just edit (fresh clones).
- Delete the `schema-order.ts` subsystem and simplify the `discoverArtifacts` signature.

**Non-Goals:**
- Changing artifact *discovery*, *kind classification*, the `ChangeDetail.artifacts` contract, or cross-surface parity — all unchanged.
- Removing schema *awareness*: the schema name is still read from `.openspec.yaml` / `openspec/config.yaml` and displayed. Only schema-based *ordering* is dropped.
- Changing which tab opens by default (still the first tab; with recency ordering that is now the most-recent artifact).

## Decisions

### Sort by filesystem mtime, newest first
Each artifact gets a timestamp and the list is sorted descending.
- Root `*.md` artifacts: `statSync(file).mtimeMs`.
- The `specs` artifact: `max(mtimeMs)` over every discovered `specs/**/spec.md` delta file — so editing any delta spec floats the specs tab forward. (Chosen over the `specs/` directory's own mtime, which on many filesystems only changes when entries are added/removed, not when a file's content is edited.)

**Why mtime, not git timestamp.** The target scenario is an in-progress superpowers-bridge run where `tasks.md` is edited but frequently *not committed* on each edit. A git last-commit timestamp would not move for uncommitted edits, so it would fail the exact case this change exists to fix. mtime reflects "what I just touched," which is the signal we want. It also needs no subprocess and no per-file git call.

### Stable narrative-order tiebreak for equal mtimes
Git does not preserve mtimes: a fresh `clone`/`checkout` stamps every file with the checkout time, so mtime-only ordering would be effectively random for a viewer looking at a repo it did not just edit. When mtimes are equal we fall back to the existing stable comparator — `proposal, design, specs, tasks` first, then alphabetical (the current `remaining.sort` logic in `artifacts.ts`, reused verbatim). A just-cloned repo therefore shows the familiar narrative order; active editing floats the touched artifact to the front.

### Delete the schema-order subsystem
`schema-order.ts` (`cliSchemaOrderProvider`, `parseOrderFromStatus`, the result cache) and the `keyForOutputPath` glob-matcher exist only to consume the CLI order. With recency ordering they have no remaining caller, so they are removed. `discoverArtifacts(repoRoot, changePath, slug?, orderProvider?)` becomes `discoverArtifacts(changePath)` — `repoRoot`, `slug`, and `orderProvider` all fall away. `scanner.ts` updates its single call site.

### Keep TypeScript and Kotlin in lockstep
Per project convention the IntelliJ Kotlin port mirrors `@spek/core`. `ArtifactDiscovery.kt` adopts the same mtime sort + tiebreak; the Kotlin schema-order resolver (`SchemaResolver.kt`'s ordering role) is removed. Unit tests on both sides are aligned to the new behavior.

## Risks / Trade-offs

- **Tab order shifts as you edit** → Intentional: recency is the chosen semantic. On a stable (unedited) checkout, mtimes tie and the deterministic narrative order applies, so casual viewers see a stable order.
- **Two files with identical mtime mid-session order by the tiebreak, not by which was touched last** → Acceptable; sub-millisecond simultaneous edits are not a real workflow, and the narrative tiebreak is a sensible default.
- **Loss of true schema-defined ordering for exotic schemas** → Accepted trade-off. The viewer treats tab order as presentation it owns; authoritative schema semantics still live in OpenSpec, and spek still surfaces the schema name.
- **Filesystems with coarse mtime granularity** → Coarse granularity only produces more ties, which resolve via the stable tiebreak — no incorrect behavior, just less recency signal.

## Migration Plan

Pure internal refactor; no data migration and no HTTP API shape change (`ChangeDetail.artifacts` still ships an ordered array). Rollback is reverting the change. The only breaking surface is the internal `discoverArtifacts` signature, whose sole caller is updated in the same change.

## Open Questions

None.
