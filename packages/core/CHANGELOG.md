# Changelog

`@spekjs/core` has its own version line, independent of the spek product releases tracked in the
repository root `CHANGELOG.md`.

## 1.3.0

- **New export: `changeNodeSlug(node)`** — resolves a graph change node back to its change slug,
  removing the worktree key that `buildGraphDataAggregated` namespaces aggregated ids with
  (`change:<worktreeKey>:<slug>`). It derives the slug from the node's `source` rather than by
  splitting on `:`, because the id alone cannot distinguish a worktree key from the leading segment of
  a slug, and it leaves an already-normalised id untouched.
- **New subpath: `@spekjs/core/graph-node-id`** — the same function, in a module with no runtime
  imports, so a browser bundle or a host's main process can use it without pulling in `node:fs` or
  `cross-spawn`. Joins `./headings` and `./artifact-order`; `changeNodeSlug` is also exported from the
  package root.

  This exists because the parsing previously lived in `@spekjs/ui`, one package away from the code
  that writes the format — the split that allowed
  [#25](https://github.com/spekhq/spek/issues/25), where core began namespacing ids and ui's parser
  did not follow. A downstream host that needed the parsing outside a bundler could not reach ui's
  copy either, since that package's only entry point carries React and d3
  ([#28](https://github.com/spekhq/spek/issues/28)). Producer and parser now sit in one place.

## 1.2.0

- **Jujutsu (jj) workspace aggregation (experimental).** `scanOpenSpecAggregated` and
  `buildGraphDataAggregated` take a new `includeJj` option (**default `false`**); when set, active
  changes are also collected from every jj workspace of the repo and merged into the same aggregated
  result as git worktrees. Contributed by [@DannyGoodall](https://github.com/DannyGoodall) (Danny
  Goodall).
- jj copies are **never** fed into the git-divergence election used for git worktrees — a jj
  working-copy commit is a change id, not a git ref, and every jj workspace materialises the full
  trunk, so history-based election is meaningless there. They get their own path: dedup by **content
  fingerprint**, keeping a diverged copy as its own entry. The git-worktree path is byte-for-byte
  unchanged, and with `includeJj` off (the default) behaviour is identical to 1.1.3.
- New exports: `listWorkspaces(dir, { includeJj })` (git worktrees + jj workspaces, deduped by path
  so a colocated main directory is counted once, with the git entry winning to keep its branch),
  `listJjWorkspaces(dir)`, `parseJjWorkspaceList(stdout)`, and `jjCurrentChangeSlugs(dir)`
  (read-only, `--ignore-working-copy`). All of them resolve to `[]` when the `jj` CLI is absent or
  the directory is not a jj repo — `jj` is never required, and nothing is spawned unless jj is
  requested.
- `ChangeInfo` gains two optional fields: `isCurrent` (this copy is what the source workspace's `@`
  is editing) and `conflictsWith` (a diverged jj copy, valued with the label of what it diverged
  from).
- **Type change (source-level breaking for constructors):** `WorktreeInfo` and `WorktreeSource`
  gain a **required** `vcs: "git" | "jj"` field. Code that only *reads* these types is unaffected;
  code that *constructs* one (a test fixture, a hand-built worktree list) must now supply `vcs`.

## 1.1.3

- `cliSchemaOrderProvider` now caches the authoritative artifact order under
  `${repoRoot}::${schema}` instead of `${repoRoot}::${slug}`. The order returned by
  `openspec status` (`planningArtifacts` + `artifactPaths`) is a property of the change's **schema**,
  not of the individual change, so changes sharing a schema now share **one** CLI spawn per 30s TTL
  window rather than paying one each. Changes whose schema cannot be resolved locally share a
  repo-level default bucket, since the CLI resolves the same built-in default for all of them.
  `resolveSchemaOrder` still runs on every read, so the `schemaOrder` delivered for any given change
  is unchanged.
- `SchemaOrderProvider` takes a third argument, `schema` (`string | null`) — the change's locally
  resolved schema name, which `readChange` passes through. It is used only to bucket the cache and
  never reaches the CLI's argv. Two-parameter providers stay assignable to the type, so injected
  providers need no change.
- `readChange` now returns `null` for an empty slug rather than resolving it to the `changes/`
  directory itself and reporting that directory as an active change.

## 1.1.2

- `scanOpenSpecAggregated` and `buildGraphDataAggregated` now **deduplicate active changes across
  worktrees by slug** instead of returning one entry (or graph node) per worktree that inherited a
  copy. The surviving copy is elected by **git divergence**: a copy is a candidate only when it has
  advanced that change past its merge-base — committed (three-dot `git diff <mainHead>...<wtHead>`
  under `openspec/changes/`) or uncommitted (`git status`). The main worktree competes on the same
  terms (reverse three-dot for its side); when no copy diverges the slug stays on main, and ties
  among the advanced copies — main included — break by most-recently-modified file (mtime). A copy
  that merely inherited an untouched change no longer shadows the copy being edited, so a change's
  `taskStats` no longer roll back to the fork-point snapshot. **No public API signature changes** —
  only which entries survive deduplication differs.
- `buildGraphDataAggregated` no longer runs a `scanOpenSpec` per worktree solely to obtain slugs; it
  derives them from the per-worktree graph it already builds, one fewer subprocess pass per worktree.

## 1.1.0

> [!WARNING]
> **This release contains a source-breaking type change, despite being a minor version.**
>
> `ChangeInfo` gains a **required** `defaultSchema: string | null` property. If your code
> *constructs* `ChangeInfo` objects — for example to feed `<ChangeTimeline changes={...} />`
> from `@spekjs/ui` — it will fail to type-check with `TS2741: Property 'defaultSchema' is
> missing`. Reading `ChangeInfo` values produced by this package is unaffected.
>
> **Migration:** add `defaultSchema` to any `ChangeInfo` you build. Pass the repo default
> schema (the `schema:` value in that change's `openspec/config.yaml`), or `null` if unknown —
> `null` simply means "no default known", and consumers that compare against it will show the
> schema badge rather than hiding it.
>
> This was shipped as a minor rather than a major because the package had no known external
> consumers at the time of release. Semver would normally call for `2.0.0`; if you were relying
> on `^1.0.0` resolving to a compatible type, pin `@spekjs/core@1.0.0`.

- `ChangeInfo` now carries `defaultSchema` — the default schema of the worktree the change was
  scanned in — so consumers can decide per change whether its `schema` diverges from its own
  repo baseline. Under cross-worktree aggregation each change carries its *own* worktree's
  default, which keeps list and detail views consistent when worktrees declare different
  `config.yaml` schemas.
- `scanOpenSpec` now reads `openspec/config.yaml` **once per scan** instead of once per change
  (it was re-read on every change that didn't declare its own `schema:`, i.e. the common case).

## 1.0.0

First public release on npm.

- **Renamed from `@spek/core` to `@spekjs/core`.** The `@spek` scope on npm is registered to another
  account, so the package could never have been published under its original name. The public API is
  unchanged — every function signature, type and subpath export is identical.
- **Runtime dependencies trimmed to `cross-spawn` alone.** The package previously declared `fuse.js`
  and `gray-matter`, neither of which it imports. Consumers no longer download them, nor
  `gray-matter`'s own transitive dependencies (`js-yaml`, `kind-of`, `section-matter`,
  `strip-bom-string`).
- Published with `dist/` and its type declarations only; sources are not shipped.
