# Design

## Context

See [proposal.md](proposal.md) for the motivation and the delta specs for behavior. Today the TypeScript and Kotlin scanners enumerate one directory level for main specs and change deltas. The web route and both HTTP servers also parse a topic as one URL segment. `SpecInfo.topic`, change delta topics, search results, and graph nodes already carry string IDs, so their wire shapes can stay stable. Main specs remain sourced from the main worktree under aggregation.

## Goals / Non-Goals

**Goals:** One unambiguous topic ID across discovery, reading, history, search, graph, URLs, and editor trees; safe nested file reads; parity between TypeScript and Kotlin hosts; compatibility with flat-topic consumers.

**Non-Goals:** Reorganizing Spek's own durable specs, changing how worktrees are elected, indexing change delta content in search, or recursing through arbitrary change-root artifact directories. Nested *changes* (`changes/<area>/<name>/`) are also out of scope: OpenSpec rejects that layout (#1846), so a change slug stays a single directory name.

## Decisions

### 1. Use the relative directory path as the topic ID

Represent a topic as non-empty path segments joined by `/`, relative to the relevant `specs/` root and without `spec.md`. This preserves existing flat IDs and distinguishes both parent/child specs and repeated basenames. Keep the existing string fields. Flat lists (the spec list payload, graph, search input) sort by full topic ID in UTF-16 code-unit order, never `localeCompare` — the same comparator OpenSpec's `discoverSpecFiles` and spek's search rule use, and the one Kotlin's `sortedBy` reproduces. Do not infer identity from a basename or a displayed folder label. A separate hierarchy object in API responses was considered but would require a wire migration while the current topic field already carries the needed identity.

### 2. Share recursive discovery and constrain filesystem reads

In TypeScript, use one recursive spec-file walker for main scans, graph/search input, and change delta discovery. Keep `listSpecFiles(changePath)` as the existing public entry point, backed by that walker; its companion presence check should short-circuit on the first nested file. Mirror the same behavior in Kotlin. Which specs exist is OpenSpec's question, so the walker states OpenSpec's own rule (`discoverSpecFiles`, #1353) rather than a stricter or looser one — a spec spek hides is one OpenSpec still archives. That rule: skip dot-entries; do not follow symlinked directories; ignore a `spec.md` directly in the `specs/` root (a spec lives in a capability folder); accept a regular `spec.md`, and accept a symlinked `spec.md` whose canonical target is a regular file within the `specs/` root, or failing that within its own capability directory; reject a symlinked `spec.md` that resolves outside both; skip a dangling link. (OpenSpec's `assertDiscoveredSpecPath` checks the specs root first and falls back to the capability directory, so a link from `specs/auth/spec.md` to a file elsewhere under `specs/` is accepted.)

Parity is in *which topics are discovered* for every repository OpenSpec accepts. Where OpenSpec instead **throws** — a `spec.md` symlink escaping both the specs root and its capability, or an unreadable directory — spek **deliberately diverges**: it omits that entry and keeps scanning. OpenSpec throws because discovery feeds the archive merge, where a silently dropped capability is lost data; spek is a read-only viewer, where omitting one entry loses nothing, and failing would blank the specs list, graph, search, and overview for the whole repository (and every worktree under aggregation) over one bad entry. This matches how the scanner already treats unreadable directories (`safeReadDir`). Do not "fix" this back to a throw. Reporting *why* an entry was omitted (a `degradedReason`-style field on `ScanResult`) is a possible follow-up, not part of this change. Convert relative filesystem segments to `/` for topic IDs on every OS. Keep change-root artifacts root-only and count the entire non-empty delta tree as one Specs artifact, with its modification time taken from all nested delta specs.

At public read boundaries, accept only non-empty relative topic segments: reject `.` and `..`, empty segments, leading/trailing separators, backslashes, absolute paths, NUL, and a resolved file outside the intended specs root. Reject version slugs that are not a single safe change-directory name. Existing core read functions return `null` for invalid or absent paths; HTTP handlers distinguish malformed input (400) from a well-formed missing spec/version (404). Checking only the string for `..` was considered insufficient because symlinks can escape the tree; the guard is containment of the *resolved* path, the same check OpenSpec applies, not a refusal of symlinks as such.

**A spec is readable only if discovery would list it.** Containment alone is weaker than discovery: `topic=.drafts/x`, or a path through a symlinked directory that points back inside `specs/`, stays contained yet names a topic the list never shows. So a read applies discovery's rule to the one path it is given — the validator rejects any segment beginning with `.`, the read refuses a path whose intermediate directories include a symlink (checked with `lstat` per segment), and a symlinked `spec.md` must satisfy the same target rule as in discovery. A read that is not eligible returns `null`, like an absent spec.

The topic rule is one exported core function, following the `isSafeSchemaName` precedent, with a Kotlin mirror whose patterns anchor with `\A`/`\z` (Java's `$` also matches before a trailing newline). It guards every read path, **including the legacy single-segment routes**: Express decodes `%2F` inside a path parameter, so `/api/openspec/specs/:topic` already delivers multi-segment and `..`-bearing topics to the reader today.

### 3. Add query-based HTTP selection and keep flat routes

On the web server, `GET /api/openspec/specs?dir=...` remains the list. `topic=<full-path>` selects detail; `topic=<full-path>&at=<slug>` selects version content. IntelliJ uses the same selectors with its `/api/spek/openspec/specs` prefix and `projectPath` parameter. A request with `at` but no `topic`, repeated/non-string selectors, or malformed topic/slug returns 400. Both hosts keep their existing single-segment detail and version routes for clients already using them. The shared `FetchAdapter` uses query selectors for both flat and nested topics; message and static adapters continue to pass the full topic string through their existing method signatures. A wildcard API route was considered, but decoding `%2F` differs between the two HTTP stacks and competes with the version suffix. (Express decodes `%2F` within a parameter after matching; IntelliJ's handler matches against `QueryStringDecoder.path()`, which is believed to decode before the `[^/]+` regex runs — unverified, confirm while implementing 4.3.)

### 4. Route natural topic URLs and project them into trees

Use `/specs/*` in every React entry point, read the splat as the full topic, and centralize link generation by encoding each topic segment. This gives human-readable deep links while keeping reserved characters safe. All spec links, including search, graph, proposal inline code, and editor navigation, use the same route rule; heading hashes retain the authored heading slug. The change Specs tab continues to prefix heading IDs with the full topic before the heading slug.

Build a pure TypeScript tree projection from the flat `SpecInfo[]` for web and VS Code, with nodes that may hold both a spec and child nodes. It lives on a browser-safe `@spekjs/core` subpath (like `headings`), because the webview bundle cannot import the package index. A node with a spec has an open action on its label and an independent expand control; a grouping-only node expands but does not open a spec. Siblings sort **per segment** in UTF-16 code-unit order — not by the full ID, which would interleave `a-b` between `a` and its child `a/c` (`-` is 0x2D, `/` is 0x2F). VS Code lists a spec-bearing node's child topics first, then that spec's own headings in document order, as a file explorer lists folders before contents. IntelliJ mirrors this projection in its tree model.

Wherever a topic is shown in one line of limited width — tree items and graph node labels — the label is the final path segment and the full topic is available as a tooltip/title. The full topic remains the identity everywhere, and **no action reads its target off a displayed label**. For the graph, `GraphNode.label` stays the full topic, so core's graph payload does not change; `SpecGraph` in `@spekjs/ui` shortens it at render time, and its spec click reports the topic taken from the node id (`spec:<topic>`) through a core `specNodeTopic` helper beside `changeNodeSlug`. Today it reports `d.label`, which would send two `streaming-search` nodes to the same, wrong place. Filtering tests the full topic ID and retains ancestor nodes. Returning a nested API payload was considered unnecessary because the flat list remains useful for search, graph, and existing consumers.

## Risks / Trade-offs

- [Recursive scans increase filesystem work] → Read only relevant `spec.md` entries, short-circuit presence checks, and exercise a corpus comparable to the supplied 93-spec example.
- [Path handling differs on Windows and Unix] → Normalize topic IDs at discovery and validate/contain every read in both runtimes; test traversal and symlink escape cases.
- [Routes or hashes lose a path segment] → Use one URL builder, test direct-load and refresh, and test parent/child IDs with duplicate basenames and headings.
- [Legacy API clients use flat endpoints] → Keep the old routes and response shapes while moving Spek's own HTTP adapter to query selectors.

## Migration Plan

No stored data migration is required. Ship recursive readers, query endpoints, route handling, and tree navigation together; existing single-level repositories and API calls remain valid. Rollback restores the prior readers and UI without modifying repository spec files.
