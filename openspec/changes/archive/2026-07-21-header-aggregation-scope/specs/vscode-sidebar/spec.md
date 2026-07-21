## ADDED Requirements

### Requirement: Worktree aggregation setting and header-control binding

The VS Code extension SHALL contribute a configuration setting `spek.aggregateWorktrees` (boolean,
default true) that controls git-worktree aggregation, mirroring the existing `spek.aggregateJjWorkspaces`
for jj. The extension handler SHALL treat both settings as the source of truth: it SHALL resolve
`aggregate` from `spek.aggregateWorktrees` (mirroring how `includeJj` is resolved from
`spek.aggregateJjWorkspaces`) for the change / overview / graph data it serves, regardless of any value
sent by the webview.

The webview aggregate checkbox on the Changes page SHALL be removed; the aggregation scope in VS Code
is controlled solely by the global header control, which reads and writes these two settings. The
handler SHALL serve `getAggregationPrefs` (returning the two settings' values) and `setAggregationPrefs`
(writing both settings at the Workspace configuration scope). The extension SHALL refresh the webview
when either aggregation setting changes, so an external settings edit is reflected in the header
control.

#### Scenario: Setting drives aggregation

- **WHEN** `spek.aggregateWorktrees` is set to false
- **THEN** the sidebar and webview show only the current directory's changes, without cross-worktree
  aggregation

#### Scenario: Header control writes the settings

- **WHEN** the user changes the aggregation scope from the header control in the VS Code webview
- **THEN** the extension updates `spek.aggregateWorktrees` and `spek.aggregateJjWorkspaces` at the
  Workspace scope, equivalent to editing `settings.json`

#### Scenario: External settings edit refreshes the control

- **WHEN** either `spek.aggregateWorktrees` or `spek.aggregateJjWorkspaces` is changed externally while
  the webview is open
- **THEN** the webview refreshes and the header control reflects the new value

#### Scenario: No aggregate checkbox on the Changes page

- **WHEN** the Changes page renders in the VS Code webview
- **THEN** it shows no aggregate checkbox; the aggregation scope is set from the header control only
