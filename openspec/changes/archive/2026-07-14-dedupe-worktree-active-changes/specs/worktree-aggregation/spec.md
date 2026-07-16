## MODIFIED Requirements

### Requirement: Aggregate active changes across worktrees

When aggregation runs over multiple worktrees, the aggregated active changes SHALL contain exactly one entry per active change slug, deduplicated across all worktrees. For a given slug, the **candidates** are the copies that have **advanced past their merge-base**. A non-main worktree is a candidate when its `HEAD` advances `openspec/changes/<slug>/` beyond its merge-base with the main worktree (three-dot `git diff <mainHead>...<wtHead>`), OR it has uncommitted modifications under that path. The main worktree competes on the same terms: it is a candidate only when the contest is live (at least one worktree diverges on the slug) AND it has itself advanced past that worktree's merge-base (reverse three-dot `git diff <wtHead>...<mainHead>`) or has uncommitted modifications there — the main worktree is never automatically beaten by a diverging worktree. A copy that merely inherited the change directory without advancing it (e.g. a freshly created worktree) SHALL NOT be a candidate, regardless of filesystem mtime. When no worktree diverges for a slug, the main worktree's copy SHALL win. Among the candidates, the copy whose change directory has the most recently modified file (by filesystem mtime) SHALL win. When divergence cannot be determined because a git command fails, that copy SHALL be treated as not diverging. Each aggregated active change SHALL carry a `source` (`WorktreeSource`) identifying the worktree whose copy won, and the aggregated entry's content (including `taskStats`) SHALL be read from that winning copy.

#### Scenario: Active changes union with source

- **WHEN** worktree A has active change `add-foo` and worktree B has active change `add-bar`
- **THEN** the aggregated active list contains both, `add-foo` with `source` pointing to A and `add-bar` with `source` pointing to B

#### Scenario: Diverging worktree copy shadows main copy of the same slug

- **WHEN** the main worktree and worktree A both have an active change with slug `add-foo`, and worktree A has advanced `add-foo` (committed progress or uncommitted edits) beyond main's `HEAD`
- **THEN** the aggregated active list contains exactly one `add-foo` entry
- **AND** its `source` points to worktree A, not main
- **AND** its `taskStats` reflect worktree A's copy

#### Scenario: Inherited-but-untouched fork does not win over the editing worktree

- **WHEN** worktree A is actively editing `add-foo` (e.g. 3 of 4 tasks done), and a worktree B is created afterwards that inherits `add-foo` without touching it
- **THEN** the aggregated `add-foo` entry's `source` points to worktree A, not the more-recently-created B
- **AND** its `taskStats` report 3 of 4, not the fork-point snapshot 0 of 4

#### Scenario: Main's uncommitted edit wins over an idle fork

- **WHEN** the main worktree has uncommitted edits advancing `add-foo` to 4 of 4 tasks, and a worktree B is created afterwards that inherits `add-foo` without touching it
- **THEN** the aggregated `add-foo` entry's `source` points to main
- **AND** its `taskStats` report 4 of 4

#### Scenario: Main's committed advance wins over an idle fork

- **WHEN** the main worktree commits progress advancing `add-foo` to 4 of 4 tasks after a worktree B was created that inherits `add-foo` without touching it
- **THEN** the aggregated `add-foo` entry's `source` points to main, not the idle fork whose copy still reflects the fork-point snapshot
- **AND** its `taskStats` report 4 of 4

#### Scenario: Both main and a worktree advance the same slug — most recently modified wins

- **WHEN** the main worktree and worktree A have each advanced `add-foo` past their merge-base (each independently committed progress or edited it)
- **THEN** the aggregated `add-foo` entry is the copy whose change directory was modified most recently — the diverging worktree does not automatically beat main
- **AND** its `source` and `taskStats` reflect that most-recently-modified copy

#### Scenario: Untouched change stays on main

- **WHEN** an active change with slug `add-foo` exists only on the main worktree, with no worktree having forked or edited it
- **THEN** the aggregated active list contains exactly one `add-foo` entry with `source` pointing to main

#### Scenario: Same active slug in two diverging worktrees resolves by recency

- **WHEN** worktree A and worktree B have both advanced an active change with slug `add-foo`, and worktree B's copy has a more recently modified file
- **THEN** the aggregated active list contains exactly one `add-foo` entry
- **AND** its `source` points to worktree B

#### Scenario: Worktree whose git divergence check fails is not a candidate

- **WHEN** the main worktree has active change `add-foo` and a non-main worktree also carries `add-foo` but its divergence cannot be determined because a git command fails
- **THEN** the aggregated `add-foo` entry's `source` points to main
