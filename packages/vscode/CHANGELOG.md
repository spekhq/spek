# Changelog

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
