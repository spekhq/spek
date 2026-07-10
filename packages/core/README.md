# @spekjs/core

Framework-agnostic engine for reading [OpenSpec](https://github.com/Fission-AI/OpenSpec) repositories.

It scans an OpenSpec directory, reads specs and changes, parses task checkboxes, and aggregates data across git worktrees — with no framework dependencies. This is the engine behind [spek](https://github.com/kewang/spek), the OpenSpec viewer (Web, VS Code, IntelliJ).

## Install

```bash
npm install @spekjs/core
```

Node.js only (ESM). Its sole runtime dependency is `cross-spawn`.

## Usage

```js
import { scanOpenSpec, readChange, parseTasks } from '@spekjs/core'

// Scan a repository's OpenSpec structure
const data = await scanOpenSpec('/path/to/repo')
// → { specs, activeChanges, archivedChanges, defaultSchema }

// Read one change, including its dynamically discovered artifacts
const change = await readChange('/path/to/repo', 'my-change-slug')
// → { slug, artifacts, schema, defaultSchema, schemaOrder, ... }

// Parse a tasks.md checkbox list
const tasks = parseTasks('- [x] 1.1 Done\n- [ ] 1.2 Pending\n')
// → { total: 2, completed: 1, sections: [...] }
```

Scanning never shells out to the OpenSpec CLI. `readChange` may query it once (cached) to resolve
schema-authoritative artifact ordering, and degrades gracefully when the CLI is unavailable.

## Main API

| Function | Purpose |
| --- | --- |
| `scanOpenSpec(basePath)` | Scan a single directory's OpenSpec structure |
| `scanOpenSpecAggregated(basePath, opts)` | Scan across every worktree of the same repo |
| `readSpec(basePath, topic)` | Read one spec, including its history |
| `readSpecAtChange(basePath, topic, slug)` | Read a spec as of a given change |
| `readChange(basePath, slug, orderProvider?)` | Read one change and its artifacts |
| `parseTasks(content)` | Parse `- [x]` / `- [ ]` checkboxes, grouped by `##` section |
| `buildGraphData(basePath)` | Build spec–change relationship graph data |
| `buildGraphDataAggregated(basePath, opts)` | The same, aggregated across worktrees |
| `listWorktrees(basePath)` | List every worktree of the same repo |
| `shouldUsePolling(path, opts?)` | Decide whether file watching must fall back to polling |

## Subpath exports

```js
import { extractHeadings, slugifyHeading } from '@spekjs/core/headings'
import { DEFAULT_ORDER, defaultRank } from '@spekjs/core/artifact-order'
```

`@spekjs/core/headings` is kept separate so browser bundles can import heading utilities without
pulling in server-only modules.

## License

MIT © Kewang
