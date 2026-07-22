## ADDED Requirements

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

## MODIFIED Requirements

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
