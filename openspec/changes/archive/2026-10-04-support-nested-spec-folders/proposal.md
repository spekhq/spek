# Proposal

## Why

Spek currently discovers only `openspec/specs/<topic>/spec.md` and single-level change delta specs. Repositories that organize capabilities in nested folders lose specs, history, search results, graph nodes, and navigation even though OpenSpec recognizes those capability paths (`discoverSpecFiles`, OpenSpec #1353, present in 1.14.0).

## What Changes

- Discover `spec.md` at any depth below the main and change `specs/` directories, using its slash-separated relative directory path as the topic ID.
- Present nested topics as folder trees in the web app and editor sidebars. A directory with both `spec.md` and child directories remains an openable spec and an expandable parent.
- Preserve the full topic ID through detail and version loading, exact-path history, search, graph, change browsing, and links.
- Add nested-topic detail and version API selection while keeping existing single-level API routes working.
- Reject malformed or escaping topic paths at read boundaries.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-scanner`: recursively discover main and change specs and identify them by full relative path.
- `spec-browsing`: show a folder tree and open nested specs.
- `spec-history`: match changes to a spec by its exact full path.
- `spec-diff`: load a nested spec's content at a change version.
- `openspec-api`: expose nested spec detail and version selection without breaking flat-topic endpoints.
- `spa-routing`: route and restore nested spec detail URLs.
- `search-semantics`: include every nested main spec as a distinct document.
- `graph-view`: preserve full topic identity in nodes, edges, and navigation.
- `change-browsing`: display and link nested delta spec topics.
- `vscode-sidebar`: group nested specs while retaining spec and heading navigation.
- `intellij-tree-view`: group nested specs while retaining spec navigation.
- `intellij-embedded-server`: scan and serve nested topics with safe path handling.

## Impact

The TypeScript core scanner and artifact discovery, web API and shared UI, VS Code sidebar, and IntelliJ Kotlin scanner, server, and tree model will change. Existing topic fields remain strings; their values may now contain `/`. Single-level repositories and routes remain supported.

### For whoever cuts the release

- **`@spekjs/core` is at least a minor bump.** `SpecInfo.topic` (and every other topic value core returns) may now contain `/`; a registry consumer that builds a file path or URL from a topic silently breaks on a nested repository. Core also gains new exports: the spec tree projection (on a browser-safe subpath), the topic-path validator, and `specNodeTopic`. The changelog entry should state the `/` semantics explicitly.
- **`@spekjs/ui` changes behavior.** `SpecGraph` will render a spec node's final path segment as its label and report the full topic (from the node id, not the label) to `onSelectSpec`. A host passing flat topics sees no difference; the changelog should state that the callback argument is the full topic.
- **`@spekjs/ui`'s `@spekjs/core` peer range must rise.** `SpecGraph` now imports `specNodeTopic` (`@spekjs/core/graph-node-id`) and `specTopicLabel` (the new `@spekjs/core/spec-topic` subpath), so the current `>=1.3.0` range admits a core that lacks both. Raise it to the core version this ships in.
- **READMEs and screenshots are release-time.** `README.md`, `README.zh-TW.md`, `packages/vscode/README.md`, and `packages/core/README.md` should describe nested folders (Specs tree, VS Code sidebar, IntelliJ tree, full-path topics, the query-selected spec API) once this ships, with retaken screenshots in the same batch.
