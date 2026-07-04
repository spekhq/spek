## 1. Core: types and authoritative ordering (delegated to OpenSpec)

- [x] 1.1 Add `ArtifactKind`, `ChangeArtifact`, and the generic `artifacts: ChangeArtifact[]` field to `ChangeDetail` in `packages/core/src/types.ts`; remove the fixed `proposal`/`design`/`tasks`/`specs` fields, add `artifactCount` to `ChangeInfo`, and add `schema: string | null` to both `ChangeInfo` and `ChangeDetail` (from change `.openspec.yaml` `schema:`, falling back to repo `openspec/config.yaml`)
- [x] 1.2 Create `packages/core/src/schema-order.ts` delegating to the OpenSpec authority instead of parsing schemas: `cliSchemaOrderProvider` runs `openspec status --change <slug> --json` and a pure `parseOrderFromStatus` extracts `actionContext.planningArtifacts` + `artifactPaths[id].outputPath`; returns `null` on CLI-absent / non-zero / archived / parse-failure (memoized per repoRoot+slug)
- [x] 1.3 Make the provider an injectable `SchemaOrderProvider` so tests supply a fake order without spawning; keep the `execFileSync` boundary thin (Stryker-excluded) with all extraction logic pure
- [x] 1.4 Unit-test `parseOrderFromStatus` (ordered extraction, skip ids without paths, non-string id/path, malformed shapes → null)

## 2. Core: artifact discovery

- [x] 2.1 Create `packages/core/src/artifacts.ts` with `discoverArtifacts(repoRoot, changePath, slug, orderProvider)`: list `*.md` at root (ignore dotfiles/non-md) and a non-empty `specs/` tree, classify each by kind (`tasks`/`specs`/`markdown`)
- [x] 2.2 Order discovered files by the authoritative provider: map each `{id, outputPath}` to a discovered file (literal basename, or `specs`-glob/`spec.md` → specs artifact), append unmatched with `proposal, design, specs, tasks` first then alphabetical; same default order when the provider returns null; humanize filename titles
- [x] 2.3 Wire discovery into `readChange` (`scanner.ts`): populate `ChangeDetail.artifacts` (markdown→content, tasks→parseTasks, specs→delta list), set `ChangeInfo.artifactCount` + `schema`; keep `createdDate`/`archivedDate`/`metadata`/`source` behavior unchanged
- [x] 2.4 Unit-test discovery + ordering with an injected provider: spec-driven default order, custom order reorders, glob→specs, non-specs glob, dotfile/non-md ignored, empty specs dir, provider not consulted without slug

## 3. Web server + API adapters

- [x] 3.1 Collapse `packages/web/server/lib/scanner.ts` duplicated detection onto core discovery so change routes return the `artifacts` array
- [x] 3.2 Update `FetchAdapter`, `MessageAdapter`, and `StaticAdapter` (and shared API types) to carry `ChangeDetail.artifacts` end to end
- [x] 3.3 Verify `/api/openspec/changes/:slug` (with `dir`/`wt`/aggregation) returns the artifacts array for both a spec-driven and a custom-schema change

## 4. Web UI rendering

- [x] 4.1 Replace `TAB_IDS` in `packages/web/src/pages/ChangeDetail.tsx` with tabs mapped from `data.artifacts`; default/unknown `?tab=` falls back to `artifacts[0]`
- [x] 4.2 Render per `kind`: markdown→`MarkdownRenderer` (with capability-id linking for all markdown artifacts), specs→`SpecsTabContent`, tasks→tasks view + `TaskProgress`
- [x] 4.3 Key TOC eligibility off artifact `kind` (markdown/specs eligible, tasks never) instead of hardcoded tab ids; preserve scrollspy/hash-anchor/sticky behavior
- [x] 4.4a Display the change's `schema` name as a small badge in the change detail header (near the lifecycle banner); render nothing when schema is null
- [x] 4.4 Manually verify in `npm run dev`: a custom-schema change shows a tab per artifact in schema order; TOC shows on a long markdown artifact and is absent on tasks

## 5. VS Code extension

- [x] 5.1 Confirm `handler.ts` `readChange` passthrough returns the new shape; update the search loop to index all discovered markdown artifacts instead of the fixed `["proposal.md","design.md","tasks.md"]` list
- [x] 5.2 Rebuild webview + extension and verify a custom-schema change renders all artifacts and search finds content in `brainstorm.md`/`plan.md`

## 6. IntelliJ plugin (Kotlin)

- [x] 6.1 Add artifact discovery + schema resolution to `core/OpenSpecScanner.kt` / `ChangeReader.kt` mirroring the core rules; add the `artifacts` array and `schema` field to `Models.ChangeDetail` (and `schema` to `ChangeInfo`)
- [x] 6.2 Update embedded-server change routes to emit the artifacts array; add Kotlin unit tests mirroring the core discovery scenarios
- [x] 6.3 Build the plugin and verify a custom-schema change renders all artifacts in the tool window — _Kotlin compiles + 8 unit tests pass; CI `intellij` job (`./gradlew test`, incl. instrumentation) is green on ubuntu+temurin; tool-window rendering uses the same React build verified in-browser_

## 7. Docs, demo, and verification

- [x] 7.1 Regenerate `docs/demo.html` via `npm run build:demo` and confirm a custom-artifact change renders in the static demo
- [x] 7.2 Update CLAUDE.md architecture notes (core artifact discovery + schema resolution; `ChangeDetail.artifacts` contract) and sync CHANGELOG across root + `packages/vscode` + `packages/intellij`
- [x] 7.3 Run `npm run type-check` and `npm run test -w @spek/core`; verify all green before archiving

## 8. CI compatibility

- [x] 8.1 Ensure the change is CI-safe without new infra: `@spek/core` and Kotlin tests inject fake order providers so they pass with no `openspec` CLI present (no dedicated CI workflow added — kept the fork PR minimal)
- [x] 8.2 Add an optional `openspec` install step to `action.yml` (the static-site GitHub Action) with telemetry disabled (`OPENSPEC_TELEMETRY=0` / `DO_NOT_TRACK=1`) so custom-schema repos get authoritative ordering; the build still succeeds via default ordering if the install fails
- [x] 8.3 Confirm `pages.yml` (uploads prebuilt `docs/`) and the vscode/intellij publish workflows are unaffected (build-only; the `openspec` CLI is spawned only at viewer runtime, not during publish)
