## ADDED Requirements

### Requirement: Workspace-aware API endpoints

The Web server openspec routes `/overview`, `/changes`, `/graph`, and `/watch` SHALL accept a `jj` query
parameter (default enabled; `jj=false` disables jj inclusion) and thread it into core as `includeJj`,
independent of the existing `aggregate` parameter. The `/watch` endpoint SHALL enumerate directories to
watch via `listWorkspaces`, so that jj workspace `openspec/` directories are watched when jj inclusion
is enabled. The `/changes/:slug` route SHALL accept a `wt` (workspace key) parameter so a same-named
slug can be resolved to the specific working copy — git worktree or jj workspace — that owns it.

#### Scenario: changes endpoint honors jj toggle

- **WHEN** `GET /api/openspec/changes?dir=...&jj=false` is requested on a colocated repo with jj workspaces
- **THEN** the response excludes jj-only workspace changes, matching git-worktree-only aggregation

#### Scenario: watch covers jj workspaces

- **WHEN** `/watch` runs with aggregation and jj inclusion enabled on a repo with a jj workspace
- **THEN** that workspace's `openspec/` directory is watched for changes
