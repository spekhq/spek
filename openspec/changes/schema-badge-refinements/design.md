## Context

The schema badge (from #6) is inline markup in `ChangeDetail.tsx` and reads `ChangeDetail.schema`. `ChangeInfo.schema` is already delivered to list views, so the badge *data* is present in `ChangeList`/`Dashboard` — only the rendering and a hide rule are missing. The repo's default schema (`openspec/config.yaml` `schema:`) is read in `@spek/core` by `readRepoSchema()` but is not currently exposed to any frontend response.

The frontend is one shared React app consumed by Web, VS Code, and IntelliJ, so UI changes in `ChangeList`/`Dashboard`/`ChangeDetail` cover all three. The changes response (`ChangesData`) is not built by a single core function — three callers assemble it: the web route (`packages/web/server/routes/openspec.ts`), the VS Code handler (`packages/vscode/src/handler.ts`), and the demo build (`scripts/build-demo.ts`). `@spek/core` is reimplemented in Kotlin for IntelliJ and must stay in parity.

## Goals / Non-Goals

**Goals:**
- Render the schema badge in Changes-list rows and Dashboard rows, reusing one component.
- Hide the badge whenever a change's schema equals the repo default (config-default comparison, not a hardcoded string), applied uniformly on all surfaces including Change Detail.
- Expose the repo default schema to the frontend cheaply (one field, no new endpoint, no CLI).
- Show a `Default schema: <name>` label on the Overview so a badge-less list is unambiguous.
- Keep TS and Kotlin cores in parity.

**Non-Goals:**
- No new API endpoint or query param.
- No CLI invocation for the default (config.yaml is read directly, staying off the scan hot path).
- No restyle/relayout of kewang's existing badge or row design — additive only.
- No version bumps / CHANGELOG for the feature branch.

## Decisions

### Config-default comparison over hardcoding `spec-driven`
Hide the badge when `change.schema === defaultSchema`. Rationale: hardcoding `spec-driven` only de-noises spec-driven-default repos; a repo whose default is a custom schema would show that identical badge on every row — the exact noise being removed. Comparing to the actual default also keeps a change authored under a *different* schema visible in any repo. Cost is a single optional field. (Alternative — hardcode `spec-driven`: simpler, no plumbing, but fails the feature's own goal for non-spec-driven-default repos. Rejected.)

### Carry `defaultSchema` on `ScanResult` → forwarded by the three callers
Add `defaultSchema: string | null` to `ScanResult` (so it flows into `AggregatedScanResult`) populated once from `readRepoSchema(basePath)` at both return points in `scanner.ts`. Each of the three `ChangesData` assemblers forwards `scan.defaultSchema`. Add the same field to `ChangeDetail`, set in `readChange` via `readRepoSchema(repoDir)`. Rationale: keeps the read in core (single source), gives every caller the value for free, and mirrors the existing per-change schema resolution. (Alternative — each caller reads config.yaml itself: duplicates logic, `readRepoSchema` isn't exported. Rejected.)

### Aggregation uses the base worktree's default
For aggregated scans, `defaultSchema` is the base/primary worktree's `config.yaml` (the `basePath` passed in). Worktrees of one repo share the same config in practice; using the base worktree is the natural, deterministic choice and avoids a per-change default.

### One `SchemaBadge` component, one hide rule
Extract the inline pill from `ChangeDetail` into `packages/web/src/components/SchemaBadge.tsx` with identical styling. It takes `schema` and `defaultSchema` and renders nothing when `schema` is falsy or `schema === defaultSchema`. All three surfaces call it, so the hide rule lives in exactly one place. It sits beside the existing `WorktreeBadge` in list/dashboard rows.

### Default-schema label on the Specs page (not the Overview)
The repo default is shown as a `Default schema: <name>` subheading beneath the **Specs** page heading, only when non-null. The Specs page is a natural home for repo-level OpenSpec metadata, and the Overview already carries enough information. The schema name reuses the same visual token as change badges: `SchemaBadge`'s pill is extracted into a presentational `SchemaPill`, which both `SchemaBadge` (hide-logic wrapper) and the Specs label consume, so a schema looks identical wherever it appears. (Earlier iteration placed the label on the Dashboard/Overview; moved per review.)

### Cache the default schema across navigation (`useDefaultSchema`)
The repo default is repo-level and effectively static for a session, but the app has no cross-navigation fetch cache — every page re-fetches on mount and only de-flickers watch-triggered refreshes (`RefreshContext`). Sourcing the label from a second per-mount fetch made it lag behind the specs list. Fix: a focused `useDefaultSchema()` hook backed by a module-scoped per-`repoPath` cache — it returns the cached value synchronously (no loading flash) and re-fetches only on first load or after a detected change. It reads `OverviewData.defaultSchema`, which is plumbed across all three adapters (unlike `detect`, whose demo `StaticAdapter` returns no schema), without reshaping the `getSpecs` contract (also consumed by `ChangeDetail`).

Cache correctness (from adversarial review): each cache entry records the `RefreshContext` `refreshKey` generation it was fetched under, and the freshness check (`resolveCachedDefaultSchema`, a pure exported function unit-tested for the hit / repo-switch / change-detected transitions) treats a hit as fresh only when its `refreshKey` matches the current one. Because `refreshKey` increments on *any* detected file change — even while the Specs page is unmounted — the next visit after a `config.yaml` edit misses and refetches, so the value self-heals rather than serving a stale default indefinitely. The fetch uses **non-aggregated** overview (`getOverview(false)`): the repo default is worktree-independent, and the aggregated cross-worktree scan was the heavy part.

`defaultSchema` is therefore exposed on `ChangesData` (for the per-row badge hide rule), `ChangeDetail` (detail header badge), and `OverviewData` (the Specs-page label source).

## Risks / Trade-offs

- [Specs-page default-schema label appears in a plain spec-driven repo where all badges are hidden] → Intended: it is the repo baseline that makes a badge-less list legible. Kept subtle (muted text), and it is a small, reviewable addition beyond the issue's two literal items — flagged in the proposal for kewang to drop if unwanted.
- [Module-scoped cache in `useDefaultSchema` is a pattern the app doesn't otherwise use] → Kept narrow and self-contained (one hook, keyed by `repoPath` + `refreshKey`, invalidated by `RefreshContext`); the decision logic is an exported pure function with unit tests; does not touch other pages, adapters, or the owner's page/fetch architecture.
- [First Specs visit of a session still fetches overview] → Acceptable one-time cost (now non-aggregated / lighter); the complaint was repeated visits ("whenever"), which are now instant from cache.
- [Aggregated cross-worktree baseline asymmetry] → In an aggregated scan, `ChangesData.defaultSchema` is the *main* worktree's config while each change's `schema` resolves against *its own* worktree's config; if two worktrees declare **different** `config.yaml` schemas, a change can show a badge in the list but not on its detail page (which compares against the change's worktree default). This only manifests with divergent per-worktree `config.yaml` schema values (rare — config.yaml is committed and normally shared), and arguably the list correctly signals "differs from the canonical/main repo default." Documented as a known limitation rather than fixed, to avoid per-change default plumbing for a rare case.
- [Specs header layout] → The Specs page heading was changed so the title stands alone with `Default schema:` and the existing "N topics" count aligned together as subheadings. This relocates the owner's existing "N topics" element (a minor deviation from the strictly-additive default), and is an intentional, author-approved layout choice — flagged here and to be called out in the PR so kewang can accept or revert it.
- [TS/Kotlin core drift] → Mirror the `defaultSchema` field and its config.yaml read in the Kotlin core in the same change; add a Kotlin unit test asserting the field is populated, matching the TS core test.
- [Three separate `ChangesData` assemblers could get out of sync] → All three forward the same `scan.defaultSchema`; a core test covers the value, and type-check flags a missing field on `ChangesData`.
- [CRLF/autocrlf line-ending churn on edited files] → Follow repo convention; avoid reformatting untouched lines when editing existing CRLF files.

## Migration Plan

Purely additive — `defaultSchema` is optional/nullable and older clients ignore it. No data migration, no rollback concerns. Ships behind no flag.

## Open Questions

None — design decisions confirmed during brainstorming (config-default comparison, uniform hide rule, Overview label as header text).
