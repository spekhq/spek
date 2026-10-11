# Spec Delta

## ADDED Requirements

### Requirement: Discover nested spec topics
The scanner SHALL discover specs below the main `openspec/specs/` tree and each active or archived change's `specs/` tree by the same rule OpenSpec's own `discoverSpecFiles` applies, so that spek shows exactly the capabilities OpenSpec validates and archives. Entries whose name begins with `.` SHALL be skipped, and symlinked directories SHALL NOT be followed. A `spec.md` directly in a `specs/` root SHALL be ignored, since a spec lives in a capability folder. A regular `spec.md` SHALL be discovered, and so SHALL a symlinked `spec.md` whose canonical target is a regular file within that `specs/` tree or within its own capability directory; a symlinked `spec.md` resolving outside both SHALL be rejected, and a dangling link SHALL be skipped. A topic SHALL be the slash-separated directory path relative to that tree on every OS, and directories without `spec.md` SHALL only act as containers. Discovered topics SHALL be ordered by UTF-16 code-unit comparison of the full topic, not by a locale-sensitive comparison.

#### Scenario: Parent and child both contain specs
- **WHEN** `openspec/specs/contracts/pagination/spec.md` and `openspec/specs/contracts/pagination/streaming-search/spec.md` exist
- **THEN** the spec list contains distinct topics `contracts/pagination` and `contracts/pagination/streaming-search`

#### Scenario: Container without a spec
- **WHEN** `openspec/specs/contracts/` has no `spec.md` but contains a nested spec
- **THEN** no topic `contracts` is returned and the nested spec is returned

#### Scenario: A spec.md in the specs root is not a topic
- **WHEN** `openspec/specs/spec.md` exists beside `openspec/specs/auth/spec.md`
- **THEN** the spec list contains `auth` and no topic for the root file

#### Scenario: Symlinked spec.md within its capability is discovered
- **WHEN** `openspec/specs/auth/spec.md` is a symlink to a regular file inside `openspec/specs/auth/`
- **THEN** topic `auth` is discovered

#### Scenario: Symlinked spec.md targeting elsewhere in specs is discovered
- **WHEN** `openspec/specs/auth/spec.md` is a symlink to the regular file `openspec/specs/shared/auth.md`
- **THEN** topic `auth` is discovered

#### Scenario: Symlinked spec.md escaping the specs tree is rejected
- **WHEN** `openspec/specs/auth/spec.md` is a symlink resolving outside `openspec/specs/`
- **THEN** no topic `auth` is discovered from it and its target is not read
- **AND** the scan still succeeds and returns every other topic — a deliberate divergence from OpenSpec, whose discovery fails on this input

#### Scenario: Symlinked directory is not followed
- **WHEN** `openspec/specs/vendor` is a symlink to a directory containing `api/spec.md`
- **THEN** no topic under `vendor` is discovered

#### Scenario: Topics are ordered by code unit
- **WHEN** main specs contain `a`, `a/c`, `a-b`, and `ab`
- **THEN** the spec list orders them `a`, `a-b`, `a/c`, `ab`

#### Scenario: Nested change delta contributes to artifact metadata
- **WHEN** an active or archived change contains only `specs/contracts/pagination/spec.md` under its delta tree
- **THEN** the change has one Specs artifact that includes topic `contracts/pagination`
- **AND** its artifact count and Specs artifact modification time reflect that nested file

### Requirement: Resolve spec topic paths safely
Spec reads SHALL accept slash-separated relative topic IDs and SHALL reject empty, absolute, traversal, or otherwise escaping topic paths. A resolved spec file SHALL remain within the requested main or change specs tree. A spec read SHALL succeed only for a topic that discovery would list: a topic with a segment beginning with `.`, a path through a symlinked directory, or a symlinked `spec.md` that fails discovery's target rule SHALL return no content. The topic rule SHALL be stated once, as an exported core function, and every spec read SHALL apply it, whichever route or adapter delivered the topic.

#### Scenario: Invalid topic does not read outside specs
- **WHEN** a spec read receives `../secrets`, `contracts//pagination`, or an absolute path as its topic
- **THEN** it returns no spec content and reads no file outside the specs tree

#### Scenario: Topic with a trailing newline is rejected
- **WHEN** a spec read receives `auth\n` as its topic
- **THEN** it returns no spec content, on every host

#### Scenario: A hidden topic is not readable
- **WHEN** `openspec/specs/.drafts/auth/spec.md` exists and a spec read receives `.drafts/auth`
- **THEN** it returns no spec content, as discovery does not list that topic

#### Scenario: A topic through a symlinked directory is not readable
- **WHEN** `openspec/specs/alias` is a symlink to `openspec/specs/contracts` and a spec read receives `alias/pagination`
- **THEN** it returns no spec content, although the resolved file lies inside the specs tree
