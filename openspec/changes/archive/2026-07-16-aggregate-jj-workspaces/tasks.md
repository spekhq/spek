# Tasks

Reuse source: git tag `archive/jj-rebased` (`2c366bd`). Pull proven files with
`git show archive/jj-rebased:<path>`. Verify each against v1.8.1 APIs before adopting.

## 1. Core — types & jj enumeration (reuse ~verbatim)

- [x] 1.1 `types.ts`: add `WorktreeInfo.vcs: "git" | "jj"`; `ChangeInfo.isCurrent?: boolean`;
      `ChangeInfo.conflictsWith?: string`
- [x] 1.2 `worktrees.ts`: `parseWorktreePorcelain` / `toWorktreeSource` set `vcs: "git"`
- [x] 1.3 add `jj-workspaces.ts` (reuse): `JJ_TEMPLATE`, `parseJjWorkspaceList` (pure, `default` first,
      `vcs: "jj"`, reuse `worktreeKey`), `listJjWorkspaces` (execFile, error → `[]`)
- [x] 1.4 `jj-workspaces.ts`: `jjCurrentChangeSlugs` (`jj diff --ignore-working-copy --name-only -r @`,
      Set, error → empty)
- [x] 1.5 `worktrees.ts`: `listWorkspaces(dir, { includeJj })` — merge git+jj, dedup by `key` (git wins
      colocated main), main first
- [x] 1.6 `index.ts`: export `listWorkspaces`, `listJjWorkspaces`, `parseJjWorkspaceList`,
      `jjCurrentChangeSlugs`

## 2. Core — VCS-dispatched aggregation (re-designed on v1.8.1)

- [x] 2.1 `scanner.ts`: add `changeContentFingerprint(repoDir, slug)` (reuse: sha1 of relative-path +
      content over the change dir)
- [x] 2.2 `scanOpenSpecAggregated`: enumerate via `listWorkspaces`; split `gitScans` (`vcs !== "jj"`)
      from jj workspaces; run `pickActiveWinners(gitScans, main)` for git (v1.8.1 path, unchanged);
      then jj content-dedup seeded from `main`'s content. **Never** pass jj entries to
      `pickActiveWinners`. Handle pure-jj repos (main is a jj workspace → emit via jj path). Compute
      fingerprints only when the repo has jj workspaces
- [x] 2.3 `buildGraphDataAggregated`: exclude jj from the election `activeEntries` (`vcs !== "jj"`);
      dedup jj nodes by fingerprint, skipping duplicates' edges so spec `historyCount` isn't inflated
- [x] 2.4 mark `isCurrent` from `jjCurrentChangeSlugs` per workspace

## 3. Core — tests (reuse + extend)

- [x] 3.1 `jj-workspaces.test.ts` (reuse): `parseJjWorkspaceList`; live `HAS_JJ`-gated cases;
      `jjCurrentChangeSlugs`
- [x] 3.2 `aggregate.test.ts` (reuse): jj-only surfaced with `source.vcs === "jj"` + `isCurrent`; jj
      toggle off == git-only; colocated main not double-counted; shared change once; divergent kept
      with `conflictsWith === "main"`
- [x] 3.3 `aggregate.test.ts`: **coexistence** test — colocated repo with an extra git worktree AND a
      jj workspace: git slug resolved by election (`source.vcs "git"`, not main), jj slug via
      fingerprint (`source.vcs "jj"`), neither swallows the other
- [x] 3.4 `divergence` / `pickActiveWinners` tests remain green unchanged (jj never enters the election)

## 4. Web (server + adapters + UI) (reuse)

- [x] 4.1 `openspec.ts`: `/overview`, `/changes`, `/graph`, `/watch` accept `jj` param → `includeJj`;
      `/watch` enumerates via `listWorkspaces`; `/changes/:slug` accepts `wt`
- [x] 4.2 `jjWorkspacePref.ts` (reuse): localStorage `spek:aggregate-jj`, default on
- [x] 4.3 `ApiAdapter` / `FetchAdapter` / `MessageAdapter` / `StaticAdapter`: thread `includeJj`
- [x] 4.4 `useOpenSpec.ts` / `ChangeList.tsx`: "Include jj workspaces" checkbox; jj source /
      editing / conflicts markers

## 5. VS Code extension (reuse)

- [x] 5.1 `package.json`: `contributes.configuration` → `spek.aggregateJjWorkspaces` (boolean, default true)
- [x] 5.2 `handler.ts` / `tree-provider.ts`: read setting, pass `includeJj`, render jj / editing /
      conflicts markers
- [x] 5.3 `panel.ts` watcher: enumerate via `listWorkspaces`

## 6. Verify & document

- [x] 6.1 `npm run type-check` + `npm run test -w @spekjs/core` green (0 skipped with `jj` installed)
- [x] 6.2 live colocated smoke: `jj git init --colocate`, `jj workspace add`, put a change in the
      workspace → appears with `source.vcs === "jj"`, `@` highlighted
- [x] 6.3 update root `CHANGELOG.md` + `packages/vscode/CHANGELOG.md` (+ `packages/intellij/CHANGELOG.md`
      note: unchanged) and `CLAUDE.md` (core module, API, VS Code setting)
- [x] 6.4 `openspec validate aggregate-jj-workspaces --strict` passes
