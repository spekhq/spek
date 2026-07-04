## Context

The four `spec-driven` artifacts are hardcoded in four independent implementations:

- `@spek/core` — `scanner.ts:67-70` (presence flags), `types.ts:48-77` (`ChangeInfo`/`ChangeDetail` fixed fields), `readChange` returning `proposal`/`design`/`tasks`/`specs`.
- web server — `packages/web/server/lib/scanner.ts:65-68` (duplicate of core).
- web UI — `packages/web/src/pages/ChangeDetail.tsx:12` (`const TAB_IDS = ["proposal","design","specs","tasks"]`).
- VS Code — `packages/vscode/src/handler.ts:144` (search file list).
- IntelliJ (Kotlin) — `OpenSpecScanner.kt`, `ChangeReader.kt`, `Models.kt`.

OpenSpec schemas declare an `artifacts` list where each artifact has `id`, `generates` (literal filename or a glob like `specs/**/*.md`), `description`, `template`, `instruction`, and `requires`. A change records its schema in `.openspec.yaml` (`schema: <name>`). OpenSpec resolves a schema name through three locations (from the CLI's `resolver.js`), in order:

1. Project-local: `<repo>/openspec/schemas/<name>/schema.yaml`
2. User override: `<global-data-dir>/openspec/schemas/<name>/schema.yaml`
3. Package built-in: `<@fission-ai/openspec>/schemas/<name>/schema.yaml`

spek is a read-only viewer that must work when embedded (VS Code, IntelliJ) without assuming the `openspec` CLI is installed in the viewed repo. So authoritative ordering must be **best-effort and optional**, and discovery must never depend on it.

## Goals / Non-Goals

**Goals**
- A change renders all of its on-disk artifacts regardless of schema, with zero spek code changes per new schema.
- When the `openspec` CLI is available, use it (the authority) to order artifacts; never reimplement schema parsing/validation.
- One shared discovery + ordering model expressed once in `@spek/core` (TS) and mirrored faithfully in the Kotlin port.
- A single generic `ChangeDetail.artifacts` contract flowing through API → adapters → UI.

**Non-Goals**
- Editing/validating artifacts, or enforcing schema `requires`/`apply` graph (spek is read-only).
- Parsing or validating `schema.yaml` ourselves — that is OpenSpec's job, reached via its CLI.
- Rendering artifact-kind-specific widgets beyond what exists today (markdown, specs delta list, tasks checkboxes). Unknown markdown artifacts render as plain markdown.
- Reworking the graph/timeline/dashboard views (they key off changes/specs, not per-artifact tabs).

## Decisions

### D1: Discovery is filesystem-first; schema only enriches
`readChange` lists the change directory: every regular `*.md` at the root → one `markdown` artifact; a `specs/` dir with ≥1 `*.md` → one `specs` artifact. Dotfiles and non-`.md` files are ignored. The schema is consulted only to reorder/label/describe what discovery already found. A present file is never hidden by a schema that omits it; a schema entry for an absent file never fabricates an artifact. (Alternative: schema-driven list — rejected as brittle when the schema is unresolvable, which is the common embedded case.)

### D2: Artifact kind classification
- `tasks.md` → kind `tasks`, parsed via existing `parseTasks` into `{ total, completed, sections }`.
- `specs/` tree → kind `specs`, carrying `{ topic, content }[]` (existing delta handling).
- every other `*.md` → kind `markdown`, carrying raw `content`.

Classification is by filename/location, not schema, so it holds when the schema is absent. `tasks.md` and `specs/` keep their special rendering; everything else is generic markdown.

### D3: Authoritative ordering delegated to the OpenSpec CLI
spek does **not** parse or validate `schema.yaml` itself — OpenSpec owns that format and can change it anytime, so a reimplementation would drift. OpenSpec does not expose its schema parser as a library (the parser lives in `@fission-ai/openspec`'s `core/artifact-graph/`, which the package's `exports` map does not surface), so the authoritative surface is the **CLI**.

`@spek/core/schema-order.ts` defines a `SchemaOrderProvider`. The default `cliSchemaOrderProvider` runs `openspec status --change <slug> --json` (cwd = repo) and extracts the authoritative ordered artifact list via the pure, unit-tested `parseOrderFromStatus`: `actionContext.planningArtifacts` gives the order, `artifactPaths[id].outputPath` gives each artifact's literal filename or glob. It returns `null` on any failure — CLI absent (`ENOENT`), non-zero exit, archived change (unsupported by `status`), or unparseable output — and the result is memoized per `(repoRoot, slug)`. The slug is validated against `^[\w.-]+$` before being passed to the (shell-on-Windows) spawn. The thin `execFileSync` wrapper is the only integration point (Stryker-excluded); all extraction logic is pure and tested.

The provider is **injectable** into `discoverArtifacts`, so tests supply a fake order without spawning a process, and the IntelliJ Kotlin port mirrors it with `ProcessBuilder` + `SchemaOrder.parseOrderFromStatus`.

### D4: Mapping authoritative entries to discovered files
For each authoritative `{ id, outputPath }`, map `outputPath` to a discovered artifact: a `specs`-targeting glob (`specs/**/*.md`) or literal `specs/.../spec.md` → the `specs` artifact; otherwise the basename minus `.md` → the matching discovered stem. Order = authoritative order for mapped artifacts, then unmapped discovered artifacts appended with `proposal, design, specs, tasks` first and the remainder alphabetical — the exact fallback used when no authoritative order is available, so spec-driven changes look the same with or without the CLI. Titles are always humanized from filenames (`retrospective.md` → "Retrospective"); spek carries no schema-supplied titles or descriptions.

### D5: Generic `ChangeDetail.artifacts` contract
```ts
type ArtifactKind = "markdown" | "tasks" | "specs";
interface ChangeArtifact {
  id: string;            // stable id = filename stem ("specs" for the delta tree)
  title: string;         // humanized from filename
  kind: ArtifactKind;
  content?: string;      // markdown kind
  tasks?: ParsedTasks;   // tasks kind
  specs?: { topic: string; content: string }[]; // specs kind
}
interface ChangeDetail {
  slug; status; createdDate; archivedDate; metadata; source?;
  schema: string | null;       // schema name the change was authored under
  artifacts: ChangeArtifact[];
}
```
The legacy `proposal`/`design`/`tasks`/`specs` top-level fields are removed; this is a coordinated breaking change to the internal API/adapter contract (all consumers updated in this change). `ChangeInfo` keeps lightweight presence flags for list views — but generalized: in addition to existing `hasProposal/hasTasks/...` (retained for compatibility with list rendering and badges), it gains an `artifactCount` so list rows need not read content. (We retain the booleans rather than churn the dashboard/list code; they're cheap `existsSync` checks.)

Both `ChangeInfo` and `ChangeDetail` also carry `schema: string | null`, read from the change's `.openspec.yaml` `schema:` field, falling back to the repo `openspec/config.yaml` `schema:`, else null. This is a simple yaml-key read (not schema parsing), used only for the displayed badge; different changes can declare different schemas, so it is read per change.

### D6: UI renders from the array
`ChangeDetail.tsx` drops the `TAB_IDS` constant and maps `data.artifacts` to tabs. Tab id = artifact `id`; default/unknown `?tab=` falls back to `artifacts[0]`. Rendering switches on `kind`: `markdown` → `MarkdownRenderer`; `specs` → existing `SpecsTabContent`; `tasks` → existing tasks+TaskProgress view. TOC logic keys off `kind` (markdown/specs eligible, tasks never) instead of hardcoded tab ids. Capability-id linking in markdown is preserved for all markdown artifacts (not just proposal).

### D7: Parity across surfaces
- web server scanner delegates to `@spek/core` (already largely a mirror) — collapse its duplicated detection onto core's discovery.
- VS Code handler `readChange` already calls core; search loop changes from the fixed `["proposal.md","design.md","tasks.md"]` list to "all discovered markdown artifacts".
- IntelliJ Kotlin replicates discovery + resolution: `OpenSpecScanner`/`ChangeReader` build the artifacts list, `Models.ChangeDetail` gains the `artifacts` array, JCEF frontend uses the same React build so it benefits automatically once the API shape matches.

## Risks / Trade-offs

- **Breaking `ChangeDetail` shape** → every adapter, the StaticAdapter demo data, and the Kotlin model must change together. Mitigation: single change touches all; `build:demo` regenerated; type-check + core tests gate it.
- **Schema parsing fragility** (custom YAML may use block scalars, anchors) → we parse only the `artifacts` list shallowly and treat any failure as "unresolved → humanized fallback", so a weird schema degrades gracefully rather than erroring.
- **Kotlin/TS drift** → two implementations of discovery/resolution. Mitigation: encode the rules as scenarios (specs) both must satisfy; add Kotlin unit tests mirroring core tests.
- **Demo data staleness** → `docs/demo.html` embeds spek's own changes; regenerate via `build:demo` and verify a custom-artifact change renders.
- **List-view flags retained** → minor redundancy keeping `hasProposal` etc. alongside `artifactCount`; accepted to avoid churning unrelated dashboard/badge code.

## Migration Plan

1. Land core: discovery + `resolveSchema` + new `ChangeDetail`/`ChangeArtifact` types + tests, keeping `scanOpenSpec`/aggregation entry points intact.
2. Update web server routes + adapters to pass through `artifacts`.
3. Update web UI (`ChangeDetail.tsx`, TOC, MarkdownRenderer usage) to render from the array.
4. Update VS Code handler (read passthrough is automatic; fix search indexing).
5. Update IntelliJ Kotlin scanner/reader/models + server routes.
6. Regenerate demo, update CLAUDE.md architecture notes, sync CHANGELOG ×3.

No data migration: existing changes on disk are unchanged; only spek's reading of them changes. Rollback = revert the change; on-disk artifacts are untouched.

## Open Questions

- Do we keep the per-artifact presence booleans (`hasProposal`…) long-term, or fully migrate list/badge code to `artifactCount`/`artifacts`? Deferred to a follow-up cleanup to keep this change focused.

_(Resolved: all three schema locations — project-local, user-level global data dir, and package built-in — are checked in OpenSpec's order, including embedded VS Code/IntelliJ contexts. See D3.)_
