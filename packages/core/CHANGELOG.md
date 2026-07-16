# Changelog

`@spekjs/core` has its own version line, independent of the spek product releases tracked in the
repository root `CHANGELOG.md`.

## 1.1.2

- `scanOpenSpecAggregated` and `buildGraphDataAggregated` now **deduplicate active changes across
  worktrees by slug** instead of returning one entry (or graph node) per worktree that inherited a
  copy. The surviving copy is elected by **git divergence**: a copy is a candidate only when it has
  advanced that change past its merge-base — committed (three-dot `git diff <mainHead>...<wtHead>`
  under `openspec/changes/`) or uncommitted (`git status`). The main worktree competes on the same
  terms (reverse three-dot for its side); when no copy diverges the slug stays on main, and ties
  among the advanced copies — main included — break by most-recently-modified file (mtime). A copy
  that merely inherited an untouched change no longer shadows the copy being edited, so a change's
  `taskStats` no longer roll back to the fork-point snapshot. **No signature changes** — only which
  entries survive deduplication differs.
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
