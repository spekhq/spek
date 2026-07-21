## ADDED Requirements

### Requirement: jj workspace setting and indicators

The VS Code extension SHALL contribute a configuration setting `spek.aggregateJjWorkspaces` (boolean, default false — experimental, opt-in) that controls whether jj workspaces are included in aggregation, independent of git
worktree aggregation. The extension SHALL read this setting and pass it to `@spekjs/core` as
`includeJj`. The sidebar SHALL indicate jj-sourced changes (showing the workspace name), mark a change
that the jj working-copy commit `@` is currently editing (`isCurrent`), and mark a change carrying
`conflictsWith` as diverging from its base.

#### Scenario: Setting disables jj inclusion

- **WHEN** `spek.aggregateJjWorkspaces` is set to false
- **THEN** the sidebar and webview exclude jj-only workspace changes, matching git-worktree-only aggregation

#### Scenario: jj source shown in sidebar

- **WHEN** the sidebar renders an aggregated change whose `source.vcs === "jj"`
- **THEN** it shows the jj workspace name as the source indicator

#### Scenario: Divergent change marked in sidebar

- **WHEN** the sidebar renders an aggregated change carrying `conflictsWith`
- **THEN** it shows a "conflicts with &lt;source&gt;" marker on that item
