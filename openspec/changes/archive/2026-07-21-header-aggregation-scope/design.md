## Context

The aggregation-scope preference (git-worktree aggregation on/off + jj inclusion) is read app-wide
(Changes, Dashboard/Overview, Graph, Timeline, live-reload watcher) but is only settable from the
Changes page, where the tri-state segmented control (`Current dir` / `Worktrees` / `Worktrees + jj`)
currently lives inside `ChangeList.tsx`. The preference itself is two booleans in `localStorage`
(`spek:aggregate-worktrees`, `spek:aggregate-jj`) collapsed into one `AggLevel` by
`utils/aggregationLevel.ts`.

Relevant structure:
- `components/Layout.tsx` renders the global header (logo, centered search, **theme toggle**, repo
  path). It already hosts app-wide behavior (`useFileWatcher`) and can reach the Repo / Theme /
  ApiAdapter / Refresh contexts.
- Only `GET /api/openspec/changes` returns the detected `worktrees` list; `/overview` does not. The
  default landing route after repo selection is `/dashboard` (Overview).
- The VS Code webview runs the same SPA (with `MemoryRouter`) and therefore renders the same
  `Layout` header. VS Code drives jj via the `spek.aggregateJjWorkspaces` setting (handler is the
  source of truth); today `ChangeList` shows a Web-only tri-state and a VS-Code-only aggregate
  checkbox, gated on `isVsCodeWebview`.

## Goals / Non-Goals

**Goals:**
- One global home for the aggregation-scope control, in the header next to the theme toggle,
  reachable from every page **in both the Web app and the VS Code webview**.
- In VS Code, the header control IS the UI for the VS Code settings: toggling it edits the settings
  (equivalent to editing `settings.json`), and editing the settings updates the control.
- Preserve the tri-state model and semantics exactly (invalid `aggregate off + jj on` stays
  unrepresentable; aggregation behavior unchanged).
- Show the control only when meaningful, and show the `Worktrees + jj` option only when jj is
  actually available — resolving the "shown in a single-worktree non-jj repo" nit.

**Non-Goals:**
- No change to aggregation logic or `@spekjs/core`.
- No redesign of the tri-state into another form (the segmented control is chosen).
- No change to IntelliJ.

## Decisions

### 1. A new `AggregationScopeContext` owns the level + the worktree list

Move ownership of the aggregation level out of `ChangeList`'s local `useState` into a new app-level
context (sibling to `ThemeContext`), provided high enough to wrap both the header and the routed
pages. It exposes `{ level, setLevel, worktrees, hasJj, aggregate, includeJj }`. The header renders
the control from this context; `ChangeList` reads `aggregate`/`includeJj` from it instead of local
state.

The preference read/write goes through the adapter (see Decision 3) rather than `localStorage`
directly, so the same context works for both hosts. Initial state is seeded synchronously from
`localStorage` (no flash on Web), then reconciled from the adapter on mount and on every
refresh/live-reload signal (so a VS Code settings change propagates into the control).

Rationale: a single source of truth means the header, the Changes list, and every consumer re-render
together when the level changes — no prop-drilling and no divergent copies of the pref.

### 2. Worktree data source — a dedicated read-only `/api/openspec/worktrees` endpoint

The control's visibility and its jj option need the detected worktree list, but only `/changes`
returns it, and `/changes` scans every change across every worktree. Add a minimal read-only
`GET /api/openspec/worktrees?dir=&jj=` endpoint that returns `core.listWorkspaces(dir, { includeJj })`
— just the worktree/jj enumeration, no change scan — plus a `getWorktrees()` method on the
`ApiAdapter` (FetchAdapter → the endpoint; MessageAdapter → `postMessage` served by a new handler
case; StaticAdapter → the demo's single source). The `AggregationScopeContext` calls `getWorktrees`
once per `(repo, jj)` and refreshes on the live-reload / refresh signal.

Rationale: a global control that lives on every page needs a page-independent, cheap source of truth
for the worktree landscape. `listWorkspaces` already exists and is exported from core and used by the
server, so the endpoint is a thin wrapper. This is chosen over reusing `/changes` deliberately: piggy-
backing on `/changes` would run a full change scan on every non-Changes page purely to learn the
worktree list — a hidden cost that would be hard to attribute to this feature later.

- **Alternative considered — reuse `/changes` via the context** (no new endpoint). Rejected: it
  couples the header to the heavy change-scan endpoint and pays that scan on pages that never show the
  change list, which is exactly the kind of buried debt this change is meant to avoid.
- **Alternative considered — feed the context only from whatever page already fetched worktrees.**
  Rejected: the landing page (Overview) never fetches worktrees, so the header control would be
  missing on first load.

### 3. Per-host preference storage behind two adapter methods; the control shows in both hosts

The header control appears in **both** hosts (no `isVsCodeWebview` gate). Its preference is backed by
each host's native storage, abstracted behind two `ApiAdapter` methods:

- `getAggregationPrefs(): Promise<{ aggregate, includeJj }>`
- `setAggregationPrefs(aggregate, includeJj): Promise<void>`

Implementations:
- **FetchAdapter / StaticAdapter (Web / Demo)** — read/write the existing `localStorage` prefs
  (`spek:aggregate-worktrees`, `spek:aggregate-jj`) via the pref utilities. Client-side, synchronous
  under the hood.
- **MessageAdapter (VS Code)** — `postMessage` to the extension host. The handler reads the two
  settings for `getAggregationPrefs`, and for `setAggregationPrefs` calls
  `config.update(..., ConfigurationTarget.Workspace)` on both `spek.aggregateWorktrees` and
  `spek.aggregateJjWorkspaces`. So toggling the control edits `settings.json`; and because the panel's
  `onDidChangeConfiguration` (extended to watch `spek.aggregateWorktrees`) refreshes the webview, an
  external settings edit flows back into the control via the refresh → `getAggregationPrefs` re-read.

The extension handler resolves both settings as the source of truth for data fetches too: an
`aggregateEnabled()` (mirroring the existing `jjEnabled()`) overrides the `aggregate` param in
`getChanges` / `getOverview` / `getGraphData`. The webview aggregate checkbox in `ChangeList` is
removed. Writes target the Workspace scope because the user framed the control as "the same as editing
`settings.json`", which conventionally means the project's `.vscode/settings.json`.

`getWorktrees` (Decision 2) is the exception: it always enumerates jj (discovery on), independent of
the setting, so the control can offer the jj option even when jj is currently disabled.

### 4. Visibility and the jj option

The header control renders only when a repo is selected AND (`worktrees.length > 1` OR jj detected).
The third segment (`Worktrees + jj`) renders only when jj is detected among the worktrees; when jj is
absent the control degrades to a two-option `Current dir` / `Worktrees`. This is what removes the
single-worktree-non-jj noise.

### 5. Mobile / narrow header

The three-segment control competes for scarce header width on mobile. On narrow viewports the control
collapses to a compact `<select>` carrying the same options; the segmented buttons are used at the
desktop breakpoint. (The header already branches on `isMobile`.)

## Risks / Trade-offs

- **[New endpoint widens the API surface]** → Kept minimal: read-only, a thin wrapper over the
  already-exported `core.listWorkspaces`, no new core logic, no change to any existing endpoint.
- **[Worktree list goes stale when a worktree is added/removed]** → The context re-fetches on the
  existing refresh / live-reload signal, the same trigger the pages already use.
- **[Header crowding on desktop with a long repo path]** → The repo path already `truncate`s; the
  control sits left of the theme toggle with fixed width.
- **[Moving level ownership could regress the persisted-preference behavior]** → Covered by keeping
  `aggregationLevel.ts` + the pref utilities unchanged and reusing their existing tests.
- **[In VS Code, toggling the control writes `.vscode/settings.json`, a possibly git-tracked file]** →
  This is the explicit intent ("same as editing settings.json"); Workspace scope is what makes the
  control and a hand-edited `settings.json` refer to the same value.

## Migration Plan

Frontend + a VS Code setting, no data migration. The Web `localStorage` keys are unchanged, so an
existing browser preference carries over. In VS Code the existing `spek.aggregateJjWorkspaces` is
unchanged and the new `spek.aggregateWorktrees` defaults to true (matching today's default-on
aggregation). Rollback is reverting the change; the added setting is inert if the code is reverted.

## Open Questions

- Should the eventual clean-up also expose the worktree count in the control (e.g. a tooltip
  "3 worktrees") now that the "Aggregate N worktrees" label is gone, or is that noise? (Lean: drop
  the count; the segment labels already say what each scope means.)
