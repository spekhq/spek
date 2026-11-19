## Context

`SpecTree` (`packages/web/src/components/SpecTree.tsx`) holds its collapsed folders in component state, so the
set is discarded whenever the Specs page unmounts — opening a spec is enough. Every folder starts open. A folder
that holds no `spec.md` of its own renders as muted, unlinked text with a `/` appended; one that holds a spec is
a link like any other spec row. While the filter has text, every folder it keeps is shown open and the toggles
are disabled, so a collapse recorded mid-filter cannot surface later.

Every host entry (`App`, `WebviewApp`, `IntellijApp`, `DemoApp`) wraps `RepoProvider` and sets a `repoPath`
(the picked repository, the VS Code workspace path, the IntelliJ project path, `"demo"`). Existing per-host view
preferences — artifact sort, sidebar collapse — live in `localStorage` with a silent fallback when it is
unavailable.

## Goals / Non-Goals

**Goals:**
- One owner of the collapsed-folder set per page, readable by both the tree and the page's controls.
- Persistence that cannot break the page: unreadable or malformed stored state means "nothing collapsed".

**Non-Goals:**
- The native sidebar trees (VS Code `TreeView`, IntelliJ `JTree`). They are separate widgets with their own
  platform conventions — VS Code's tree already offers a built-in collapse-all — and the report is about the
  webview page.
- Remembering the filter text, or a scroll position.
- Changing the default for a repository the reader has never folded: all folders open.

## Decisions

**Persist the collapsed set, not the expanded one.** Stored state is the list of folder topic paths the reader
closed. A folder that appears later — a new spec directory — is therefore open, which is today's default and
keeps new content visible. Storing the expanded set instead would hide every new folder from a reader who once
used Collapse all. The reporter's "open in the last expanded folder" is what the collapsed set gives: close
the others, keep one open, and that is the state on return.

**Key by repository.** `localStorage["spek:spec-tree-collapsed:" + repoPath]`, a JSON array of topic paths.
Folder paths are only meaningful within one repository — two repositories may both have `product/` — and
`repoPath` is set on every host. One key per repository rather than one map, so a write touches only the
current repository's entry and a malformed entry spoils only that one. Stale paths (a folder since renamed) are
harmless to display — a path matching no folder affects nothing — and are dropped on the next write: every
write is pruned to the foldable folders of the **unfiltered** tree, `foldablePaths(buildSpecTree(specs))`.
Pruning happens only on a write the reader caused (a toggle, Collapse all, Expand all) — never on mount, on a
read, or in an effect — so a tree that is still loading, empty, or filtered can never wash the stored set out.

**Lift the state to `SpecList`, keep `SpecTree` controlled.** A hook `useSpecTreeCollapsed(repoPath,
foldablePaths)` owns read, write and the fallback; `SpecList` passes the set and the toggle to `SpecTree` and
the bulk actions to `SpecTreeControls`. `SpecTree` keeps its own filtering rule (open everything, toggles
inert).

The hook reads once, in its `useState` initialiser. No host can change `repoPath` while `SpecList` is mounted —
the Web app changes repository only through `/`, which sits outside `Layout`, and the webview / IntelliJ / demo
entries render the router only after `repoPath` is set — so there is no re-read effect to get wrong.

What is tested is what can be tested without a DOM, since the suite renders with `renderToStaticMarkup` and the
repository has no jsdom: the storage functions, `foldablePaths`, `SpecTree` (controlled, so any collapsed set
can be rendered) and `SpecTreeControls` (presentational). `SpecList` is wiring only, checked by hand.
`SpecList` itself cannot be rendered to a tree there — with a repository it stops at `Loading...`.

**Storage is reached inside the guard.** The storage functions take a getter (`() => localStorage`), not the
object, and call it inside their `try`: touching the `localStorage` global itself throws — a `ReferenceError`
under Node, a `SecurityError` in a sandboxed iframe embedding the demo — before any `getItem` would.

**Collapse all closes every folder with children, spec-bearing or not.** A spec-bearing parent is a folder too;
leaving it open would leave the tree partly expanded after "Collapse all". Expand all empties the set.

**Controls: a presentational `SpecTreeControls`, not `FoldControls`.** `FoldControls` is a tri-state over
`FoldMode` (`default` / `expanded` / `collapsed`) whose buttons stay pressed; the tree has no resting mode to
return to, so its buttons are plain actions. They take the fold controls' border and text tokens so the two
pages read alike, but not `FoldControls`' classes verbatim: those are never disabled, so they hover to the
accent unconditionally. Here hover is `enabled:hover:` and the disabled state is `disabled:opacity-50
disabled:cursor-not-allowed` — `disabled:` being the one opacity prefix `contrast.test.ts` admits (WCAG 1.4.3
exempts inactive components). They are hidden when the **unfiltered** tree has no folder with children — so
typing a filter that leaves a flat result does not make them vanish and shift the layout — and disabled while
filtering, for the same reason the per-folder toggles are.

**Drop the trailing `/`; no icon; the name toggles.** Without the `/`, a grouping folder is told from a
spec-bearing parent (which also has a disclosure triangle) by its muted, regular-weight text and by not being a
link. To add an affordance rather than only a style, the grouping folder's name becomes part of its toggle
button — clicking it folds the folder, as double-clicking a folder does in the IntelliJ tool window's tree. A
spec-bearing parent's name stays the link to its spec. A folder glyph was rejected: it would be the only icon in
a list whose spec rows carry none. The full topic path stays in the row's `title`, now required by the spec
for folders as it already was for specs.

## Risks / Trade-offs

- [Every VS Code window shares one webview origin] → VS Code picks a webview panel's origin from an
  application-scoped store keyed by view type and extension id (read from 1.143's workbench bundle), so its
  `localStorage` survives window reloads and is **shared by every workspace**. That is the reason the key
  carries `repoPath`. Remote workspaces (SSH / WSL) with the same path on different machines share a key; it is
  a view preference, so this is accepted.
- [IntelliJ's origin follows the built-in server's port] → JCEF writes `localStorage` to disk (observed in a
  2023.3.8 sandbox), so state survives an IDE restart — but the origin is `localhost:<port>`, and the port moves
  when another JetBrains IDE already holds 63342. State does not follow a port change. Not verified for 2026.x.
- [A repository with hundreds of folders collapsed writes a long JSON array] → bounded by the folders the
  unfiltered tree holds, since every write is pruned to it; no cap needed.
- [Two windows on the same repository overwrite each other's set] → last write wins; the state is a view
  preference, not data.
