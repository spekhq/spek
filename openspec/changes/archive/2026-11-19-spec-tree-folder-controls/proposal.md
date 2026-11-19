## Why

Issue #75: on the Specs page of a repository whose specs are grouped into folders, the folder tree forgets
everything the reader did to it. Collapse `product/` and `quality/` to work inside `process/`, open a spec,
come back — every folder is open again. There is no way to collapse or expand the whole tree at once, and a
folder that groups specs without holding one of its own is labelled `process/`, a trailing separator the
reporter read as part of the folder's name.

The tree is the shared React page, so the same behaviour reaches the Web app, the VS Code panel and the
IntelliJ tool window's webview (the report was filed against IntelliJ; its screenshot is this page).

## What Changes

- A folder's open/closed state on the Specs page is remembered per repository, across leaving and returning
  to the page and across reloads where the host keeps web storage. Folders the reader never touched stay open,
  as today.
- The Specs page gains **Expand all** / **Collapse all** controls for the folder tree, shown only when the tree
  has a folder to fold, and inert while a filter is applied (a filter already opens every folder it keeps).
- A folder without its own spec is labelled with its name alone — no trailing `/`. It stays distinguishable
  from a spec by not being a link and by its muted text, and clicking its name now folds it.
- `spec-browsing`'s "Display all specs" scenario, which assumed every folder opens on arrival, is restated: every
  folder the reader has not collapsed is expanded.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `spec-browsing`: the spec list's folder tree states how folders are labelled, that their open/closed state
  persists per repository, and that the whole tree can be expanded or collapsed at once.

## Impact

- `packages/web`: `SpecTree.tsx` (labels, controlled open state), `SpecList.tsx` (controls, state owner), a new
  hook persisting the collapsed folders. Reaches every surface that loads the SPA: Web, VS Code webview,
  IntelliJ webview, and the demo.
- No change to `@spekjs/core`, the API, the Kotlin host, or the native VS Code / IntelliJ sidebar trees.
- Release notes: user-visible behaviour on all three product channels; no registry-consumer impact.
