## Purpose

提供無框架依賴的共用邏輯套件 @spekjs/core（掃描、讀取、tasks 解析、型別），供 web server 與各 extension host 共用。
## Requirements
### Requirement: Standalone core package
The core module SHALL be an independent npm package (`@spekjs/core`) with no framework dependencies, usable by both the web server and the VS Code extension host.

#### Scenario: Import from web server
- **WHEN** the Express server imports `@spekjs/core`
- **THEN** it can call scanner and task parser functions directly without additional adapters

#### Scenario: Import from extension host
- **WHEN** the VS Code extension host imports `@spekjs/core`
- **THEN** it can call scanner and task parser functions directly without additional adapters

### Requirement: Scanner functions
The core module SHALL export scanner functions that accept a base path and return structured OpenSpec data. The `build-demo.ts` script SHALL separate the concept of "data source path" (where openspec/ lives) from "build tooling path" (where spek's packages/web lives), allowing the script to scan an external repository while using spek's own build tooling.

#### Scenario: Scan overview
- **WHEN** `scanOverview(basePath)` is called with a valid repo path
- **THEN** it returns `{ specsCount, changesCount: { active, archived }, taskStats: { total, completed } }`

#### Scenario: List specs
- **WHEN** `listSpecs(basePath)` is called
- **THEN** it returns an array of `{ topic, path }` for each spec directory

#### Scenario: Read single spec
- **WHEN** `readSpec(basePath, topic)` is called with an existing topic
- **THEN** it returns `{ topic, content, relatedChanges, history }`

#### Scenario: Build demo from external repo
- **WHEN** `build-demo.ts` is called with `--repo-dir` pointing to a different repository
- **THEN** all `@spekjs/core` functions receive the external repo path as `basePath`
- **AND** Vite build still runs from spek's own `packages/web` directory

#### Scenario: List changes
- **WHEN** `listChanges(basePath)` is called
- **THEN** it returns `{ active: ChangeInfo[], archived: ChangeInfo[] }`

#### Scenario: Read single change
- **WHEN** `readChange(basePath, slug)` is called with an existing change slug
- **THEN** it returns `{ slug, proposal, design, tasks, specs, metadata }`

#### Scenario: Search content
- **WHEN** `searchContent(basePath, query)` is called
- **THEN** it returns matching results across specs and changes with context snippets

### Requirement: Task parser functions
The core module SHALL export task parsing functions that operate on raw Markdown content strings.

#### Scenario: Parse tasks from content
- **WHEN** `parseTasks(content)` is called with Markdown containing `- [x]` and `- [ ]` checkboxes
- **THEN** it returns `{ total, completed, sections }` with tasks grouped by `##` headings

### Requirement: Shared type definitions
The core module SHALL export all TypeScript type definitions used by both the web app and the extension.

#### Scenario: Type imports
- **WHEN** the web app or extension imports types from `@spekjs/core`
- **THEN** types such as `OverviewData`, `SpecInfo`, `SpecDetail`, `ChangeInfo`, `ChangeDetail`, `ParsedTasks`, `SearchResult` are available

### Requirement: Heading extraction utility
The core module SHALL export `extractHeadings(content: string)` and `slugifyHeading(text: string)` utilities that parse markdown content and produce deterministic, ordered heading metadata for use by both the webview and the VS Code extension host. `extractHeadings` SHALL return only `h2` and `h3` headings, in document order, each with `{ level: 2 | 3, text: string, slug: string }`. Headings inside fenced code blocks SHALL be ignored.

#### Scenario: Extract h2 and h3
- **WHEN** `extractHeadings(content)` is called with content containing `## Section A`, `### Sub A1`, and `## Section B`
- **THEN** it returns `[{ level: 2, text: "Section A", slug: "section-a" }, { level: 3, text: "Sub A1", slug: "sub-a1" }, { level: 2, text: "Section B", slug: "section-b" }]`

#### Scenario: Ignore h1 and h4+
- **WHEN** `extractHeadings(content)` is called with content containing `# Title`, `## Section`, and `#### Detail`
- **THEN** the returned array contains only the `h2` `Section` entry

#### Scenario: Ignore headings inside code blocks
- **WHEN** the content contains a fenced code block whose body includes lines beginning with `## ` or `### `
- **THEN** those lines are NOT returned as headings

#### Scenario: Slug duplicates suffixed
- **WHEN** the content contains two headings with identical text
- **THEN** the first heading's slug is the base slug and the second heading's slug ends with `-2`

#### Scenario: Slugify lowercase and dash
- **WHEN** `slugifyHeading("Requirement: Spec list with filtering")` is called
- **THEN** it returns `"requirement-spec-list-with-filtering"`

#### Scenario: Slugify collapses non-alphanumeric runs
- **WHEN** `slugifyHeading("Hello,  World!! How?")` is called
- **THEN** it returns `"hello-world-how"`

#### Scenario: Slugify preserves Unicode word characters
- **WHEN** `slugifyHeading("章節 Foo")` is called
- **THEN** it returns `"章節-foo"` (Unicode letters preserved, spaces collapsed to dash)

#### Scenario: Empty content
- **WHEN** `extractHeadings("")` is called
- **THEN** it returns an empty array

### Requirement: Published to the public npm registry
The core package SHALL be published to the public npm registry under the name `@spekjs/core`, so that repositories outside this monorepo can install and import it. The published tarball SHALL contain the compiled `dist/` output together with its type declarations, and SHALL NOT contain source files.

#### Scenario: Install from a repository outside this monorepo
- **WHEN** a repository that is not a workspace member of this monorepo runs `npm install @spekjs/core`
- **THEN** the package resolves from the npm registry, and `import { scanOpenSpec } from '@spekjs/core'` succeeds without referencing any local path

#### Scenario: Published tarball contents
- **WHEN** the package tarball is inspected before publishing
- **THEN** it contains `dist/` with both `.js` and `.d.ts` files, plus `package.json`, `README.md`, `LICENSE` and `CHANGELOG.md`, and it does not contain `src/`

#### Scenario: Runtime dependencies limited to what core actually imports
- **WHEN** the published package's `dependencies` are inspected
- **THEN** they list only the packages that core actually imports, so that consumers are never forced to install dependencies core does not use

#### Scenario: Subpath exports resolve for external consumers
- **WHEN** an external consumer imports `@spekjs/core/headings`, `@spekjs/core/artifact-order` or `@spekjs/core/graph-node-id`
- **THEN** each subpath resolves to its compiled module and type declarations

#### Scenario: Node-free subpaths carry no Node dependency
- **WHEN** a consumer imports one of those subpaths from a browser bundle or from a process that must not load `node:fs`
- **THEN** the import succeeds, because each of those modules is pure logic with no runtime import of a Node built-in or of the package's server-side modules

### Requirement: Graph node id parsing

The core module SHALL export the function that resolves a graph change node back to its change slug,
beside the code that produces the id format. `buildGraphData` emits `change:<slug>` and
`buildGraphDataAggregated` emits `change:<worktreeKey>:<slug>`; the same package SHALL own reversing both.

The function SHALL derive the slug from the node's `source` — populated only on aggregated graphs — rather
than by splitting the id on its separator, because the id alone does not distinguish a worktree key from
the leading segment of a slug. Where a key is present, it SHALL be removed only when the remainder
actually begins with it, so that an id a caller has already normalised is left unchanged.

It SHALL be reachable without loading any Node-only module, so that a browser bundle or a host's main
process can import it — see the subpath scenarios under "Published to the public npm registry".

#### Scenario: Non-aggregated node

- **WHEN** the function is given a change node whose id is `change:<slug>` and which carries no `source`
- **THEN** it returns `<slug>`

#### Scenario: Aggregated node

- **WHEN** the function is given a change node whose id is `change:<worktreeKey>:<slug>` and whose
  `source` identifies that worktree
- **THEN** it returns `<slug>`, without the worktree key

#### Scenario: Already-normalised id

- **WHEN** the function is given a node whose id is `change:<slug>` but which still carries a `source`
- **THEN** it returns `<slug>` unchanged, rather than removing a prefix that is not there

