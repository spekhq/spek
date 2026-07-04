## Purpose

提供無框架依賴的共用邏輯套件 @spek/core（掃描、讀取、tasks 解析、型別），供 web server 與各 extension host 共用。

## Requirements
### Requirement: Standalone core package
The core module SHALL be an independent npm package (`@spek/core`) with no framework dependencies, usable by both the web server and the VS Code extension host.

#### Scenario: Import from web server
- **WHEN** the Express server imports `@spek/core`
- **THEN** it can call scanner and task parser functions directly without additional adapters

#### Scenario: Import from extension host
- **WHEN** the VS Code extension host imports `@spek/core`
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
- **THEN** all `@spek/core` functions receive the external repo path as `basePath`
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
- **WHEN** the web app or extension imports types from `@spek/core`
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
