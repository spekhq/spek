## Why

spek hardcodes the four `spec-driven` artifacts (`proposal.md`, `design.md`, `tasks.md`, `specs/`) in every layer — core scanner, web server, VS Code handler, and the IntelliJ Kotlin port — so a change authored under any other OpenSpec schema (e.g. `superpowers-bridge` with `brainstorm.md`, `plan.md`, `verify.md`, `retrospective.md`) is silently truncated: its extra artifacts never appear. OpenSpec now lets repos declare custom schemas, and spek should display whatever a change actually contains rather than only the artifacts it was hand-coded to know about.

## What Changes

- Replace hardcoded artifact detection with **filesystem-driven discovery**: any `*.md` at a change root plus the `specs/` delta tree become artifacts, so unknown schemas render with zero spek changes.
- **Schema-enrich** the discovered artifacts when the schema named in `.openspec.yaml` (`schema:`) is resolvable — use its `artifacts` list to order, label, and describe tabs; fall back to a humanized filename (`brainstorm.md` → "Brainstorm") otherwise. Discovery, not the schema, is the source of truth — a schema that is missing or lists an absent file never hides a present file.
- Generalize `ChangeDetail` from fixed `proposal`/`design`/`tasks` fields to a dynamic **artifacts array** (id, title, kind, content/structured data), while keeping `tasks` parsing and `specs` delta handling as recognized artifact kinds.
- Render the change detail UI from the artifacts array: tabs, TOC, and lifecycle behavior driven by data, not a fixed `TAB_IDS` constant. **BREAKING** internal contract change to `ChangeDetail` shape across the API and adapters.
- Mirror the same generic model across all four surfaces: `@spek/core`, web (server + React), VS Code extension, and IntelliJ (Kotlin scanner/reader + JCEF frontend), and include all discovered artifacts in search indexing.

## Capabilities

### New Capabilities
- `custom-schema-artifacts`: Schema-agnostic discovery of a change's artifacts from the filesystem, optional enrichment from a resolved schema definition, the generic `ChangeDetail` artifacts contract shared across core/API/adapters, and the parity requirement that web, VS Code, and IntelliJ all render the same dynamic artifact set.

### Modified Capabilities
- `openspec-scanner`: "Parse change artifacts" changes from detecting fixed `proposal`/`design`/`tasks`/`specs` files to dynamically discovering and classifying all artifacts in a change directory.
- `change-browsing`: "Change detail with tab navigation" and "Change detail TOC sidebar" change from a fixed Proposal/Design/Specs/Tasks tab set to tabs generated from the discovered artifacts array (markdown artifacts get a TOC, task/structured artifacts do not).

## Impact

- Core: `packages/core/src/scanner.ts`, `types.ts`; new schema-resolution + artifact-discovery modules.
- Web: `packages/web/server/lib/scanner.ts`, change routes, `packages/web/src/pages/ChangeDetail.tsx`, API adapters.
- VS Code: `packages/vscode/src/handler.ts` (read + search).
- IntelliJ: `OpenSpecScanner.kt`, `ChangeReader.kt`, `Models.kt`, embedded-server routes.
- Contract: `ChangeDetail` shape (API responses, all three adapters) — coordinated change across packages.
- Docs: CLAUDE.md architecture notes; CHANGELOG (root + vscode + intellij, kept in sync).
