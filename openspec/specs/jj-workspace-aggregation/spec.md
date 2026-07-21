# jj-workspace-aggregation Specification

## Purpose
TBD - created by archiving change aggregate-jj-workspaces. Update Purpose after archive.
## Requirements
### Requirement: Discover jj workspaces

The `@spekjs/core` package SHALL provide an async function `listJjWorkspaces(dir)` that returns the
Jujutsu workspaces of the repository containing `dir`, by executing `jj workspace list` with a custom
template, with `dir` as the working directory. Each entry SHALL be a `WorktreeInfo` with `vcs: "jj"`,
`path` (absolute workspace root), `branch` set to the workspace name, `head` set to the working-copy
change id, `isMain` true for the `default` workspace, `isBare` false, and a path-derived `key`. The
`default` workspace SHALL appear first regardless of jj's alphabetical output order. When `dir` is not
inside a jj repository, when `jj` is not installed, or when the command fails, `listJjWorkspaces` SHALL
return an empty array.

#### Scenario: Colocated repo with an added workspace

- **WHEN** `listJjWorkspaces(dir)` is called on a colocated repo with the `default` workspace and one
  added workspace
- **THEN** it returns two `WorktreeInfo` entries, each with `vcs: "jj"`, `default` first

#### Scenario: Not a jj repository

- **WHEN** `listJjWorkspaces(dir)` is called where `dir` is not inside a jj repo, or `jj` is not installed
- **THEN** it returns an empty array

### Requirement: Deduplicate jj active changes by content identity

Because jj workspaces share one commit graph and each materialises the full trunk, the same active
change appears in every workspace. Active changes sourced from jj workspaces SHALL be deduplicated
against the base (the main / `default` workspace) and against one another by `slug` + a **content
fingerprint** (a hash over the relative paths and byte contents of every file in the change directory):

- A jj copy whose fingerprint is byte-identical to an already-seen copy of that slug SHALL be dropped.
- A jj copy whose `slug` matches an already-seen copy but whose content differs SHALL be kept as a
  separate entry attributed to its workspace, carrying a `conflictsWith` label naming the source it
  diverges from (normally the main workspace).
- A jj copy whose `slug` is new (unique to that workspace) SHALL be kept and source-tagged.

The baseline SHALL be seeded from the main workspace's content regardless of whether the main copy won
the git election for that slug. This deduplication SHALL be applied only when the repo actually has jj
workspaces, so git-only repositories perform zero additional I/O.

#### Scenario: Shared change appears once

- **WHEN** a trunk change is materialised identically across four jj workspaces
- **THEN** the aggregated active list contains exactly one entry for that change

#### Scenario: Divergent workspace copy kept and flagged

- **WHEN** two jj workspaces carry the same slug but one has edited it so its content differs from the base
- **THEN** the base copy appears without a conflict flag and the divergent copy appears as a separate
  entry with `conflictsWith` naming the base and `source.vcs === "jj"`

### Requirement: Mark the change the jj working copy is editing

The `@spekjs/core` package SHALL provide `jjCurrentChangeSlugs(dir)` that returns the set of active
change slugs the jj working-copy commit `@` is currently editing, using
`jj diff --ignore-working-copy --name-only -r @` (read-only; it SHALL NOT trigger a working-copy
snapshot). When `jj` is unavailable the set SHALL be empty. Aggregated active changes whose slug is in
this set for their workspace SHALL be marked `isCurrent: true`.

#### Scenario: Currently-edited change is marked

- **WHEN** a jj workspace's `@` is editing change `feature-x` and aggregation runs with jj inclusion on
- **THEN** the aggregated `feature-x` entry from that workspace has `isCurrent: true`

### Requirement: Independent jj inclusion toggle

jj workspace inclusion SHALL be an experimental, opt-in capability, controllable independently of git
worktree aggregation and **disabled by default**, and SHALL degrade gracefully: when `jj` is not installed or the repo is not a jj repo,
behaviour SHALL be byte-for-byte identical to git-worktree-only aggregation and `jj` SHALL NOT be
required at runtime.

#### Scenario: jj inclusion disabled matches git-only

- **WHEN** aggregation runs on a colocated repo with jj workspaces but jj inclusion is disabled
- **THEN** the result is identical to git-worktree-only aggregation, with no jj-sourced changes

#### Scenario: jj not installed

- **WHEN** aggregation runs on a repo where `jj` is not installed
- **THEN** aggregation proceeds over git worktrees exactly as before, with no error

