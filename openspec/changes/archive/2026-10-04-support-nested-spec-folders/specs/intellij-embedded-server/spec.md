# Spec Delta

## ADDED Requirements

### Requirement: Kotlin scanner discovers nested specs
The IntelliJ scanner SHALL include every main and change delta `spec.md` at any depth under its respective specs tree, by the same discovery rule and in the same order as the TypeScript scanner (see `openspec-scanner`), with the slash-separated relative directory path as topic. Nested specs SHALL participate in list, detail, history, search, graph, and change artifact responses with the same identity as the TypeScript host.

#### Scenario: Nested list and change response
- **WHEN** a project has main and delta specs for `contracts/pagination/streaming-search`
- **THEN** the IntelliJ specs list and change detail return that full topic path

#### Scenario: Exact nested history
- **WHEN** separate changes affect `contracts/pagination` and `contracts/pagination/streaming-search`
- **THEN** IntelliJ history for the child includes only its own change

### Requirement: IntelliJ API selects nested specs safely
The IntelliJ server SHALL accept `GET /api/spek/openspec/specs?projectPath=<project>&topic=<full-topic>` for detail and the same request with `at=<change-slug>` for version content. The request without `topic` SHALL remain the list endpoint; existing single-level routes SHALL remain available and SHALL apply the same topic and slug validation. Topic validation SHALL match the TypeScript rule exactly; patterns SHALL anchor with `\A`/`\z`, since Java's `$` also matches before a trailing newline. Invalid or escaping topic paths, malformed change slugs, or `at` without `topic` SHALL return HTTP 400, and absent content SHALL return HTTP 404 without reading outside the requested specs tree.

#### Scenario: Get nested detail and version
- **WHEN** a client requests topic `contracts/pagination/streaming-search`, with and without `at=add-streaming-search`
- **THEN** the corresponding full spec detail or change delta content is returned

#### Scenario: Reject escaping topic
- **WHEN** a request supplies a topic containing `..`, an empty segment, or an absolute path
- **THEN** the server returns HTTP 400 and reads no file outside the specs tree

#### Scenario: Reject a topic with a trailing newline
- **WHEN** a request supplies topic `auth%0A`
- **THEN** the server returns HTTP 400

#### Scenario: Reject malformed version selector
- **WHEN** a request supplies `at` without `topic` or a change slug containing a path separator
- **THEN** the server returns HTTP 400
