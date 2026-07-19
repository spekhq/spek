# Changelog

## 1.8.3

- **Lists with blank lines between their items render correctly again (Web, VS Code and IntelliJ).** Every bullet and number was pushed onto its own line, above the text it belonged to, which made proposals and task lists hard to scan. Markers now sit inline with the first line of their item. Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen) for reporting and contributing this.

## 1.8.2

- **Opening a change is much faster (Web, VS Code and IntelliJ).** Each change took about a second to open. To order a change's tabs, spek asks the OpenSpec CLI for the artifact order that the change's schema defines — and it repeated that request for every change, even though every change sharing a schema gets the same answer back. The answer is now looked up once per schema instead of once per change, so only the first change you open pays for it and the rest open immediately. Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen) for contributing this.

## 1.8.1

- **Changes shared across git worktrees no longer show up multiple times (Web and VS Code).** When you work in several worktrees of one repo, each inherits a copy of every open change; spek was listing every copy, cluttering the Changes list and the dependency Graph, and inflating each spec's fan-in count in the graph. It now shows one entry per change — the copy from the worktree actually editing it — decided from git history (which worktree has advanced the change past the main worktree) rather than file timestamps as the primary signal; timestamps now only break a tie between copies that have *both* genuinely advanced. Because a fresh worktree rewrites every file's timestamp on checkout, the old timestamp-first guess could pick an idle, never-touched copy and make an in-progress change look reset to zero; that no longer happens. Thanks to [@david-lutz](https://github.com/david-lutz) (David Lutz) for contributing this.

  **Note:** the IntelliJ plugin has its own copy of the scanning logic and is not fixed by this release — changes still appear once per worktree there.

## 1.8.0

- **The Refresh button now actually refreshes.** The circular-arrow button at the bottom of the sidebar — previously labelled "Resync" — only rebuilt an internal cache. It never re-fetched what was on screen, so if you edited a file and pressed it, nothing happened; you had to navigate away and back before your change showed up. It now re-fetches, and it keeps spinning until the new data has actually arrived instead of stopping before it lands (which made a working refresh look like a broken one). Thanks to [@deniskrizanovic](https://github.com/deniskrizanovic) for reporting.
- **A dead live-update connection is no longer silent (Web).** spek normally refreshes on its own when files change, over a background connection that can drop without any outward sign. When it drops, the sidebar now says so and points you at Refresh, rather than leaving you staring at stale content with no indication that anything is wrong. **Note:** this makes the failure *visible*; it does not yet make the connection recover on its own. If auto-refresh stops, press Refresh.
- **IntelliJ: the Refresh button was completely dead.** The plugin's built-in server had no endpoint for it, so every click returned HTTP 404 and the frontend gave up silently. The endpoint now exists, and Refresh no longer depends on it succeeding.
- **IntelliJ: stopped a pointless background retry loop.** The webview mistook itself for the web app and kept reconnecting, forever, to a path the plugin's server never serves.

## 1.7.0

- **spek has moved to the `spekhq` GitHub organization** — the repository is now [`spekhq/spek`](https://github.com/spekhq/spek). Clones, links, issues, and stars redirect automatically, so for most users there is nothing to do. **Two things do not redirect:**
  - **GitHub Action users must update their workflows** — change `uses: kewang/spek@v1` to `uses: spekhq/spek@v1`. GitHub deliberately does not redirect action references (a redirect would let a rename hijack someone else's action), so the old path now fails with `repository not found`.
  - **The live demo and the README badges moved** to `https://spekhq.github.io/spek/`. GitHub Pages is not redirected after a transfer, so the old `kewang.github.io/spek/` URLs are gone for good.
- **GitHub Action: fixed a build failure that hit every run** — the action never built `@spekjs/ui` explicitly; it got that package's `dist` for free from an install-time hook that `npm ci` happened to run. When the hook moved to publish time (so `npm ci` would stop failing in the publish pipelines), the action silently lost its `@spekjs/ui` build and every run died resolving `@spekjs/ui/styles.css`. Pinning an older tag did not help — the action builds spek from `master` by default, so the breakage reached everyone at once. The action now builds `@spekjs/ui` explicitly.

## 1.6.1

- **TOC navigation lands on the section you clicked** — clicking a table-of-contents entry, or opening a `#hash` deep link, on a Change or Spec detail page no longer scrolls the target heading behind the sticky header, which made it look like the click had jumped one section too far. The offset is now measured from the header that is actually rendered instead of an assumed 80px, and the entry you clicked is the one the TOC highlights.
- **Schema badge under worktree aggregation** — when changes are aggregated across worktrees, each change's schema is now compared against the default schema of the worktree it actually lives in, rather than the main worktree's. A change that uses its own worktree's default no longer shows a badge, and the list and detail views agree on this. Scanning also reads each worktree's `openspec/config.yaml` once instead of once per change.

Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen) for both.

## 1.6.0

- **Hideable tree navigator (IntelliJ)** — the Specs / Changes tree in the spek tool window can now be hidden from the tool window title bar or its gear (⋮) menu, giving the viewer the full tool window. The choice is remembered per project, and the split ratio is persisted too instead of resetting every time you reopen the project. While hidden, the tree no longer rebuilds on file changes; it refreshes when you bring it back. Thanks to [@deniskrizanovic](https://github.com/deniskrizanovic) for reporting.

## 1.5.0

- **Custom OpenSpec schemas** — a change's artifacts are now discovered from disk, so a change authored under any schema (not just the built-in `spec-driven`) renders every artifact as its own tab. Previously anything outside `proposal` / `design` / `tasks` / `specs` was silently dropped. Full-text search now indexes every markdown artifact as well.
- **Artifact tab ordering** — tabs default to last-modified order so the artifact you're actively editing surfaces first. A sort control adds **Schema order** (sourced from the OpenSpec CLI, degrading gracefully to the default order when the CLI is unavailable or the change is archived) and **A–Z**. The choice persists across changes.
- **Schema badge** — each change's schema is shown as a badge on the Changes list, the Dashboard, and Change Detail. It is hidden when the change uses the repo's default schema (from `openspec/config.yaml`), so a badge always means "this change uses a non-default schema"; the Changes page states the repo default as a plain-text label.

Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen) for contributing all of the above.

## 1.4.0

- Live-reload now works inside devcontainers and WSL. On filesystems that don't deliver native OS change events (9p / drvfs / NFS / CIFS / FUSE), spek automatically falls back to polling — so files created or edited after opening it are still detected. Detection is based on the watched path's filesystem type and needs no configuration; an optional `SPEK_WATCH_POLLING=on|off` escape hatch exists only if you ever need to force it. Applies to the Web, VS Code, and IntelliJ live variants. Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen) for contributing this feature.

## 1.3.4

- Fix: the Timeline no longer falls back to "No timeline data" when a change's `created:` date is set correctly. The IntelliJ plugin's backend never read `created:` from `.openspec.yaml` (so every change lost its created date on the Timeline), and the Web / VS Code parser dropped `created:` from files saved with CRLF (`\r\n`) line endings. Both backends now surface `createdDate` and `archivedDate` consistently, and the Timeline empty state no longer wrongly claims the `created:` field is missing.

## 1.3.3

- Fix: the IntelliJ plugin now installs on IntelliJ Platform 2026.1 (build 261.x) and newer — the `until-build` upper bound (`253.*`) that caused "requires IDE build 253.* or earlier" has been removed, so the plugin tracks current and future IDE releases (#4)
- Update the published `kewang/spek` GitHub Action off the deprecated Node 20 runtime — bump `actions/checkout` to v7, `actions/setup-node` to v6, and `actions/cache` to v6; internal CI workflows and README examples updated to match (#7)

## 1.3.2

- Update VS Code Marketplace keywords/tags for better discoverability — replace `bdd` with `sdd`, add `spec-driven-development` and `ai`, and drop `documentation` / `viewer`

## 1.3.1

- Fix: a fresh clone now starts cleanly with `npm install && npm run dev` — `@spek/core` resolves to its gitignored `dist/` build, which neither install nor dev used to produce, so the Express API failed with `ERR_MODULE_NOT_FOUND` and Vite failed to resolve `@spek/core/headings`. `npm install` now compiles `@spek/core` (new `prepare` script) and the root `dev` script rebuilds it before launching (#2)

## 1.3.0

**Highlight: Cross-worktree aggregation** — when you run agents in parallel across multiple git worktrees, spek now shows the OpenSpec content of *all* worktrees in one place, instead of forcing you to point spek at each worktree by hand.

- Point spek at any directory and it auto-discovers every git worktree of the same repo, then merges their active changes, archived changes, and the spec-change graph into a single unified view
- Each change card / row is tagged with its source worktree branch, so you can tell at a glance which worktree a change lives in
- A toggle turns aggregation off to view only the current directory
- Active changes from each worktree coexist (same-named slugs are both shown, identified by their source worktree); archived changes are deduped by slug; the specs list always comes from the main worktree
- Aggregation is the default whenever multiple worktrees are detected — single-worktree or non-git repos behave exactly as before
- Supported in the Web version and the VS Code extension (IntelliJ and Demo are unchanged)
- Fix: the VS Code extension now uses chokidar for file watching, so newly created nested directories (e.g. a change's `specs/<topic>/spec.md`) are detected and the change-detail spec tab live-reloads correctly

## 1.2.0

- Add `/timeline` page: horizontal Gantt-style chart of every change's lifecycle — active bars extend to today with an arrow, archived bars render as fixed segments
- Timeline supports an optional "Group by topic" toggle and "Hide active / Hide archived" filter chips, plus an auto-scaling time axis (daily / weekly / monthly / quarterly ticks based on span)
- Read `created:` from `.openspec.yaml` and derive `archivedDate` from archive folder name; surface lifecycle info in `ChangeInfo` / `ChangeDetail` (server payload adds two backwards-compatible fields)
- ChangeList row shows `Created Apr 20 · 5d ago` for active changes and `Created Feb 14 → Archived Feb 22 · 8d` for archived ones
- ChangeDetail header gains a lifecycle banner (e.g., `Created 2026-02-14 · Archived 2026-02-22 (8 days)` or `Active for 5 days`)
- Dashboard adds two stats cards: **Avg lifecycle (archived)** and **Stale active (>30d)**
- VS Code sidebar shows lifecycle days in change descriptions and includes the created date in tooltips
- New `@spek/web` test runner (`npm test -w @spek/web`) covers the timeline scale and grouping helpers

## 1.1.0

- Add table-of-contents (TOC) sidebar to spec detail pages — sticky navigation lists all `h2`/`h3` headings, with scrollspy highlighting and smooth scrolling on click
- Add TOC sidebar to change detail pages for the Proposal, Design, and Specs tabs (Tasks tab excluded); TOC updates when switching tabs
- Persist the active tab in the change detail URL (`?tab=<id>`) and support deep links with both tab + hash (e.g., `?tab=design#decision-1`)
- Specs tab: prefix each delta spec's heading ids with `<topic>--` so multiple specs with the same heading text no longer collide
- Support URL hash anchors on spec detail pages (e.g., `/specs/foo#requirement-bar` scrolls to that heading)
- Expand spec items in the VS Code sidebar to reveal their headings as child nodes; clicking a heading opens the webview at the corresponding section
- Add `extractHeadings` and `slugifyHeading` utilities to `@spek/core` for shared heading parsing across web and extension hosts
- Web: reloads and direct URL visits now restore the most recent repo from localStorage instead of bouncing back to the repo-selection page

## 1.0.2

- Unify date format to YYYY-MM-DD across all pages (Dashboard, ChangeList, SpecDetail)
- Fix demo SpecList not showing "N changes" count

## 1.0.1

- Add SVG badge generation (specs count, open changes, tasks status) to GitHub Action and release workflow
- Fix CI publish triggers to only match semver tags (avoid triggering on v1 floating tag)

## 1.0.0

- First stable release
- Publish GitHub Action to Marketplace — use `kewang/spek@v1` in your workflows
- Update README examples to reference `@v1` stable tag

## 0.7.9

- Remove demo auto-rebuild GitHub Action — demo rebuild is now handled exclusively by the release workflow

## 0.7.8

- Add GitHub Action for building OpenSpec static sites
- Add Open VSX Registry publishing to VS Code extension CI/CD workflow

## 0.7.7

- Fix deprecated `URL(String)` constructor usage in IntelliJ plugin (resolves Plugin Verifier warning)
- Fix IntelliJ plugin.xml change-notes sync with release workflow

## 0.7.6

- Add native tree view navigation to IntelliJ plugin (Specs and Changes sidebar)
- Add URL hash-based navigation for IntelliJ external browser fallback
- Update acknowledgments in README

## 0.7.5

- Add external browser fallback for IntelliJ plugin when JCEF is unavailable (e.g., Android Studio)

## 0.7.4

- Fix IntelliJ plugin HTTP 404 error when opening specs/changes at startup
- Fix README install instructions and plugin.xml change-notes

## 0.7.3

- Add IntelliJ IDEA plugin — browse OpenSpec content in IntelliJ-based IDEs via Tool Window + JCEF
- Add IntelliJ plugin CI/CD — auto publish to JetBrains Marketplace on `v*` tag push
- Add IntelliJ Marketplace metadata — plugin icon, rich description, change notes, vendor info
- Fix `.nvmrc` to use exact Node.js version 22.22.0

## 0.7.2

- Fix sidebar navigation race condition when webview panel is not open
- Add electron skill for Electron desktop app automation

## 0.7.1

- Fix VS Code extension not activating in workspaces without `config.yaml` — sidebar and status bar now appear for any valid OpenSpec repo (with `specs/` or `changes/` directory)

## 0.7.0

- Add Activity Bar sidebar — browse specs and changes directly from the VS Code sidebar without opening the Command Palette
- TreeView with two sections: Specs (alphabetical) and Changes (grouped by active/archived)
- Click any item to open the spek webview panel and navigate to that spec or change
- Auto-refresh TreeView when openspec files change on disk

## 0.6.4

- Fix change detail showing "Change not found" error during file watcher refresh (e.g., after archiving a change)
- Improve API error messages — show descriptive server errors instead of generic "HTTP 404"

## 0.6.3

- Add git timestamp to changes — sort by precise commit time instead of date-only slug, display relative time (e.g., "3 hours ago") in Dashboard and Changes list
- Fix detect fallback — repos with openspec/ directory but no config.yaml are now correctly detected

## 0.6.2

- Sticky change detail header — change title and tab navigation stay fixed below the header when scrolling through long content

## 0.6.1

- Fix VS Code live-reload not detecting directory moves (e.g., archive operations)

## 0.6.0

- Live reload — spek viewer automatically refreshes when openspec files change on disk
- Web: Server-Sent Events (SSE) with chokidar file watching
- VS Code: FileSystemWatcher with postMessage notification
- Debounced refresh (500ms server + 300ms client) preserves existing data without loading flash

## 0.5.0

- Interactive spec-change graph view — D3 force-directed graph showing relationships between specs and changes
- Spec nodes (amber circles) scaled by history count, change nodes (colored rects) by spec count
- Graph interactions: drag, hover highlight, click navigation, zoom/pan with fit-to-viewport
- New `/graph` route with sidebar navigation link, working across Web, VS Code, and demo

## 0.4.0

- Spec diff viewer — compare current spec content against any historical change version with unified diff view
- Compare button on spec history timeline entries for quick diff access
- New API endpoint and core function for reading spec content at specific change versions
- Full support across Web, VS Code extension, and demo environments

## 0.3.1

- Add custom tab icon (spek logo) to VS Code webview panel for better visual identification

## 0.3.0

- Standalone demo page — self-contained HTML with embedded openspec data for GitHub Pages
- UI design polish — tab order, animations, search highlights, accessibility improvements
- Fix demo search — use ApiAdapter instead of direct fetch
- Plus Jakarta Sans web font for improved typography
- Add acknowledgments section to README

## 0.2.1

- GitHub Actions CI/CD — auto build and publish to VS Code Marketplace on `v*` tag push
- `npm version` auto-syncs version between root and vscode package.json

## 0.2.0

- Collapsible sidebar with icon-only mode — click toggle button to collapse/expand
- Sidebar state persisted in localStorage (web) across sessions
- Smooth CSS transition animation for sidebar width changes

## 0.1.0

Initial release.

- Dashboard with specs/changes overview and task completion stats
- Specs browser with detail view and revision history
- Changes timeline with tabbed views (Proposal / Design / Tasks / Specs)
- BDD syntax highlighting (WHEN/GIVEN, THEN, AND, MUST/SHALL)
- Task progress tracking with section-grouped progress bars
- Full-text search across specs and changes (Cmd+K)
- Markdown rendering with remark-gfm
- Dark / Light theme toggle
- Responsive layout with mobile support
- Repo selection with path validation and recent history
- Git-based spec history timestamps with in-memory cache
- VS Code extension with Webview Panel integration
- Brand logo and favicon
- Bilingual README (English / 繁體中文) with screenshots
