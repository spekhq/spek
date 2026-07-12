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
`OpenSpecScanner.kt` has the identical `readChangeSchema` fallback; thread the once-computed default through its `scanChangeDir` equivalent and stamp it on the Kotlin `ChangeInfo`/model. IntelliJ renders no aggregated cross-worktree list, so the per-change comparison is a no-op there, but stamping the field keeps the model aligned with `@spekjs/core` and removes the redundant reads.

**D6 — Kotlin's `defaultSchema` carries no default value (added in review).**
Declaring the Kotlin field as `val defaultSchema: String? = null` would silently undo the point of making the TS field required. With a default, a producer that forgets to stamp the field still compiles; `Json { encodeDefaults = true }` then emits `"defaultSchema": null`, and the shared frontend's `SchemaBadge(schema, null)` evaluates `schema === null` → false → a badge on **every** change in a single-schema repo — precisely the noise this capability exists to suppress. The field is therefore a required constructor parameter on `ChangeInfo`, `ChangeDetail` and `ChangesData`, matching the TS contract. All three construction sites already pass a value, so this is a compile-time guard with no behavior change.

**D7 — `@spekjs/core` ships this as 1.1.0, and the type break is documented rather than hidden (added in review).**
`ChangeInfo` is public API of the **published** `@spekjs/core`, and `@spekjs/ui`'s `ChangeTimeline` takes `changes: ChangeInfo[]` — the UI components are pure presentation, so hosts *construct* `ChangeInfo`. Adding a required property is therefore source-breaking for constructors, which strict semver would answer with a major (`2.0.0`).

The owner's call is to ship it as **1.1.0**: `@spekjs/core` had no known external consumers, and the one downstream (`spekterm`) is updated in step, so the practical blast radius is nil and doing it now is cheaper than living with an optional field. The trade-off is explicit — a consumer pinned to `^1.0.0` would pick 1.1.0 up automatically — so it is called out prominently in `packages/core/CHANGELOG.md` (a warning block with a migration note and the reason it is not a major) rather than smuggled through as a routine minor.

*Alternative considered:* make the field optional (`defaultSchema?: string | null`) and keep the guarantee internally by narrowing the scanner's return type. That would be non-breaking and semver-clean, at the cost of the public contract no longer forcing producers to stamp the field. Rejected in favour of a single honest contract across TS and Kotlin (see D6).

## Risks / Trade-offs

- **[Signature change to `readChangeSchema` / `scanChangeDir` breaks internal callers]** → Both are module-private in `scanner.ts`; the only callers are `scanOpenSpec` and `readChange`, both updated in the same change. No public API surface changes.
- **[`ChangeInfo` gaining a required field breaks type consumers]** → **This risk materialised; the stated mitigation was wrong.** `npm run type-check` does *not* cover the monorepo — it only runs `tsc` in `packages/web`. `packages/ui` was never type-checked, and its `ChangeTimeline` test fixture constructs a `ChangeInfo` literal, so the required field left it type-invalid (`TS2741`) while its 22 tests stayed green (`packages/ui/tsconfig.json` excludes `__tests__`, and the suite runs through tsx without a typecheck). The fixture is fixed here, and the real breakage — `ChangeInfo` is public API of the published `@spekjs/core`, which downstream hosts *construct* — is handled by D7 (ship as 1.1.0 with the break documented). The absence of any test/typecheck CI in `.github/workflows/`, which let a type-invalid file sit unnoticed, is out of scope and tracked separately.
- **[Demo data staleness]** → `docs/demo.html` is a build artifact; rebuilding it (`npm run build:demo`) picks up the new field. Not shipping a stale demo is covered by the normal build step, not this change's logic.
- **[Behavior drift for the common single-worktree repo]** → In that case a change's own `defaultSchema` equals `ChangesData.defaultSchema`, so the badge decision is identical to today — the existing #10 scenarios still hold, which the retained scenarios assert.

## Migration Plan

No data migration and no rollback concern within the product; deploy is a normal build. If reverted, the only in-product regression is the return of the redundant reads and the aggregated mismatch.

The **published package** is a different matter: `@spekjs/core` goes to **1.1.0** carrying a source-breaking type change (required `ChangeInfo.defaultSchema`). Consumers that *construct* `ChangeInfo` — e.g. to feed `<ChangeTimeline changes={...} />` from `@spekjs/ui` — must add the field; passing `null` is valid and means "no default known". Consumers that only *read* `ChangeInfo` values produced by the package are unaffected. See D7 for why this ships as a minor, and `packages/core/CHANGELOG.md` for the migration note carried to npm.

## Open Questions

None. The issue prescribes the approach; the only decision (D1 vs. its alternative) is resolved above.
