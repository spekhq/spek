## Context

Resolves upstream issue kewang/spek#11, a follow-up to merged PR #10 (schema badge in list views). PR #10 added `defaultSchema` to `ChangesData` and `ChangeDetail` and a badge that hides when a change's `schema` equals the repo default. It left two things, both rooted in *where* and *how often* the repo default is resolved:

1. **`readChangeSchema` (`scanner.ts:83-90`)** falls back to `readRepoSchema(repoDir)` — a fresh `existsSync` + `readFileSync` + regex of `openspec/config.yaml` — for every change without its own `schema:`. A scan of N active + M archived changes reads that one file N+M times, plus one more for `ScanResult.defaultSchema` (`scanner.ts:191`). `readChange` (`scanner.ts:253-254`) reads it twice on its own.
2. **`scanOpenSpecAggregated` (`scanner.ts:465`)** ships one `defaultSchema` from the main worktree, but each change's `schema` was resolved against its *own* worktree's config. Divergent per-worktree schemas therefore produce a change whose list badge (compared vs. main's default) disagrees with its detail badge (compared vs. its own worktree's default). PR #10's `design.md` flagged this and deferred it.

Both collapse into one fix: resolve the default **once per worktree scan** and carry it *on the change* so every comparison uses the change's own baseline.

## Goals / Non-Goals

**Goals:**
- Read `openspec/config.yaml` at most once per worktree per scan (down from N+M+1).
- Stamp a per-change `defaultSchema` on `ChangeInfo` so the list/dashboard badge compares each change against its own worktree's default.
- Make the aggregated list badge agree with the change's detail badge.
- Mirror the read-once efficiency in the Kotlin core.
- Zero behavior change for single-worktree, single-schema repos.

**Non-Goals:**
- No change to `ChangesData.defaultSchema` semantics — it stays the main-worktree baseline feeding the `Default schema: <name>` header.
- No aggregation support in IntelliJ (it has none); only the efficiency half lands there.
- No caching of `config.yaml` across scans, no file-watching invalidation — scope is a single scan pass.
- No restyle/relayout of the badge or header (respect the owner's #10 design).

## Decisions

**D1 — Approach 1: pass the pre-computed default into `readChangeSchema`.**
`scanOpenSpec` computes `const defaultSchema = readRepoSchema(repoDir)` once and threads it through `scanChangeDir(repoDir, changePath, slug, status, defaultSchema)`. `readChangeSchema(changePath, defaultSchema)` returns the change-declared schema or the passed `defaultSchema` — it no longer calls `readRepoSchema` and no longer needs `repoDir`.
*Alternative considered — Approach 2* (rename to `readDeclaredSchema` returning `null`, apply `?? defaultSchema` in `scanChangeDir`): functionally identical, marginally cleaner single-responsibility, but a larger diff (rename ripples to the other caller) for a low-priority fix the maintainer already sketched in Approach-1 shape. Chose Approach 1 to minimize review friction.

**D2 — `defaultSchema` becomes a field on `ChangeInfo`.**
`scanChangeDir` stamps the passed default onto each `ChangeInfo`. Because each worktree's scan (in `scanOpenSpecAggregated`) calls `scanOpenSpec`/`scanChangeDir` with *its own* `repoDir`, every change automatically carries the default of the worktree it came from — the correctness fix falls out of the same plumbing, no per-change worktree bookkeeping needed. `ChangeDetail.defaultSchema` already exists and is already per-change (resolved from the change's `basePath` in `readChange`), so no type change there.

**D3 — Frontend compares per-change.**
`ChangeList` and `Dashboard` change `<SchemaBadge schema={c.schema} defaultSchema={changesData.defaultSchema} />` to `defaultSchema={c.defaultSchema}`. `SchemaBadge`'s hide logic (`schema == null || schema === defaultSchema`) is unchanged — only the value fed in changes. `ChangeDetail` already passes its own `defaultSchema`, so it is untouched.

**D4 — `ChangeInfo` threads through all three adapters unchanged in shape.**
`FetchAdapter` (REST JSON) carries the new field for free. `MessageAdapter` (VS Code postMessage) passes core objects through, so it carries it for free. `StaticAdapter` reads build-time demo data; the demo build (`scripts/build-demo.ts` → `@spek/core`) will emit `defaultSchema` on each change once core does, so no adapter code change is required — but the API `ChangeInfo` type (`packages/web/src/api/types.ts`) must gain the field so TypeScript keeps the contract honest end-to-end.

**D5 — Kotlin mirror is efficiency-only.**
`OpenSpecScanner.kt` has the identical `readChangeSchema` fallback; thread the once-computed default through its `scanChangeDir` equivalent and stamp it on the Kotlin `ChangeInfo`/model. IntelliJ renders no aggregated cross-worktree list, so the per-change comparison is a no-op there, but stamping the field keeps the model aligned with `@spek/core` and removes the redundant reads.

## Risks / Trade-offs

- **[Signature change to `readChangeSchema` / `scanChangeDir` breaks internal callers]** → Both are module-private in `scanner.ts`; the only callers are `scanOpenSpec` and `readChange`, both updated in the same change. No public API surface changes.
- **[`ChangeInfo` gaining a required field breaks type consumers]** → Add it as a required field in `@spek/core` and mirror in `packages/web/src/api/types.ts`; `type-check` across the monorepo is the gate. Adapters pass objects through, so runtime is unaffected.
- **[Demo data staleness]** → `docs/demo.html` is a build artifact; rebuilding it (`npm run build:demo`) picks up the new field. Not shipping a stale demo is covered by the normal build step, not this change's logic.
- **[Behavior drift for the common single-worktree repo]** → In that case a change's own `defaultSchema` equals `ChangesData.defaultSchema`, so the badge decision is identical to today — the existing #10 scenarios still hold, which the retained scenarios assert.

## Migration Plan

Pure additive refactor; no data migration, no rollback concern. Deploy is a normal build. If reverted, the only regression is the return of the redundant reads and the aggregated mismatch — no data or API-shape breakage either way.

## Open Questions

None. The issue prescribes the approach; the only decision (D1 vs. its alternative) is resolved above.
