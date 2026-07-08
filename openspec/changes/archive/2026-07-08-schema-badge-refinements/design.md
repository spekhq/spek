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

### Default-schema label on the Changes page
The repo default is shown as a `Default schema: <name>` subheading beneath the **Changes** page heading, only when non-null. The Changes page is where divergent-schema badges appear, so showing the repo baseline there is exactly where it earns its keep — it explains why most rows carry no badge and frames the ones that do. Crucially, the Changes page already fetches `ChangesData` (which carries `defaultSchema` for the per-row hide rule), so the label reads that value directly: **no extra request, no caching hook, no `OverviewData` field, no data-fetching machinery** — the label simply renders with the list it already awaits. The subheading is purely additive to the Changes header (it does not relocate any existing element).

(Earlier iterations placed the label on the Dashboard/Overview and then the Specs page — the latter needed a bespoke `useDefaultSchema` cache and an `OverviewData.defaultSchema` field because the Specs page doesn't fetch changes; moving it to the Changes page removed all of that.)

### Plain-text default vs. pill for divergence
The default-schema indicator is rendered as **plain muted text**, not the pill used for change badges. Giving the baseline the same pill as the exceptions conflated two opposite meanings (a row pill means "this change deviates from the default"; a baseline pill means "this *is* the default"). Reserving the pill for divergent-schema badges makes it read unambiguously: a pill anywhere = a non-default schema. Because the label no longer needs the pill visual, the earlier `SchemaPill`/`SchemaBadge` split is folded back into a single `SchemaBadge` component. In the list and Dashboard rows the badge sits on the **right**, grouped with the change's date/lifecycle metadata, so the change title stays clean and the schema reads as a row attribute; the existing `WorktreeBadge` stays by the title (kewang's element, unmoved). This is a minor deviation from the issue's "sit alongside `WorktreeBadge`" hint, flagged for the PR.

`defaultSchema` is therefore exposed on `ChangesData` (per-row badge hide rule **and** the Changes-page label) and `ChangeDetail` (detail header badge) — two surfaces, both of which genuinely consume it.

## Risks / Trade-offs

- [Changes-page default-schema label appears in a plain spec-driven repo where all badges are hidden] → Intended: it is the repo baseline that makes a badge-less list legible, shown right where the badges live. Kept subtle (muted text, additive to the header), and it is a small, reviewable addition beyond the issue's two literal items — flagged in the proposal for kewang to drop if unwanted.
- [Aggregated cross-worktree baseline asymmetry] → In an aggregated scan, `ChangesData.defaultSchema` is the *main* worktree's config while each change's `schema` resolves against *its own* worktree's config; if two worktrees declare **different** `config.yaml` schemas, a change can show a badge in the list but not on its detail page (which compares against the change's worktree default). This only manifests with divergent per-worktree `config.yaml` schema values (rare — config.yaml is committed and normally shared), and arguably the list correctly signals "differs from the canonical/main repo default." Note the Changes-page label and the Changes-page row badges both read the same `ChangesData.defaultSchema`, so they are always mutually consistent; only the separate detail-page read can differ. Documented as a known limitation rather than fixed, to avoid per-change default plumbing for a rare case.
- [TS/Kotlin core drift] → Mirror the `defaultSchema` field and its config.yaml read in the Kotlin core in the same change; add a Kotlin unit test asserting the field is populated, matching the TS core test.
- [Three separate `ChangesData` assemblers could get out of sync] → All three forward the same `scan.defaultSchema`; a core test covers the value, and `ChangesData.defaultSchema` is a required field so type-check flags any assembler that omits it.
- [CRLF/autocrlf line-ending churn on edited files] → Follow repo convention; avoid reformatting untouched lines when editing existing CRLF files.

## Migration Plan

Purely additive — `defaultSchema` is optional/nullable and older clients ignore it. No data migration, no rollback concerns. Ships behind no flag.

## Open Questions

None — design decisions confirmed during brainstorming (config-default comparison, uniform hide rule, Overview label as header text).
