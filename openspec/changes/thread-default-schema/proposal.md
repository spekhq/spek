## Why

Follow-up to merged PR #10, resolving upstream issue kewang/spek#11. One change fixes two problems that share a root cause — each change's schema is resolved against a repo default that is recomputed per change and, under cross-worktree aggregation, is the *wrong* worktree's default:

- **Efficiency**: `readChangeSchema` re-reads and regex-parses `openspec/config.yaml` on every change that doesn't declare its own `schema:` (the common case), so a scan does N+M+1 reads of the same small file — pointless repeated I/O on the `/changes` and `/overview` hot path.
- **Correctness**: `scanOpenSpecAggregated` ships a single `defaultSchema` from the main worktree, but each change's `schema` was resolved against *its own* worktree's `config.yaml`. With divergent per-worktree schemas, a change that inherits worktree B's default gets a false schema badge in the list (compared against main's default) yet no badge on its detail page (compared against B's default) — a list↔detail mismatch #10 documented as a known limitation.

## What Changes

- `scanOpenSpec` computes the repo default schema **once** (`readRepoSchema(repoDir)`) and threads it into the per-change scan, so `config.yaml` is read once per scan instead of N+M+1 times.
- `readChangeSchema` takes the pre-computed default as a parameter instead of re-reading `config.yaml` itself (Approach 1: minimal diff, function keeps its shape).
- `scanChangeDir` stamps that default onto each `ChangeInfo` as a new `defaultSchema` field. Under aggregation, each worktree's scan stamps *its own* default, so every change carries the correct per-worktree baseline.
- List and Dashboard render the schema badge by comparing each change's `schema` against its **own** `defaultSchema` (per-change) instead of the single ships-level `ChangesData.defaultSchema` — removing the false-positive badge and the list↔detail mismatch together.
- `ChangesData.defaultSchema` is unchanged and keeps feeding the `Default schema: <name>` page header (the main-repo baseline, which is correct there).
- The Kotlin core (`OpenSpecScanner.kt`) mirrors the read-once efficiency half. IntelliJ has no aggregation path, so the correctness half does not apply there.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `custom-schema-artifacts`: The "Surface the schema name per change" requirement changes so `defaultSchema` is exposed on `ChangeInfo` (not only `ChangesData` and `ChangeDetail`), and the badge hide-rule compares each change against its **own** worktree's default rather than a single repo-wide default — making the comparison correct under cross-worktree aggregation.

## Impact

- **Core**: `packages/core/src/scanner.ts` (`readChangeSchema`, `scanChangeDir`, `scanOpenSpec`, `readChange`), `packages/core/src/types.ts` (`ChangeInfo.defaultSchema`).
- **Adapters/API**: `ChangeInfo` now carries `defaultSchema`; `FetchAdapter`, `MessageAdapter`, `StaticAdapter` (demo data) and API types must preserve it end-to-end.
- **Web UI**: `ChangeList` and `Dashboard` switch the badge comparison to per-change `defaultSchema`; `ChangeDetail` and the Changes header are unchanged.
- **Kotlin**: `packages/intellij/.../core/OpenSpecScanner.kt` mirrors the read-once fallback (efficiency only).
- No behavior change for single-worktree, single-schema repos.
