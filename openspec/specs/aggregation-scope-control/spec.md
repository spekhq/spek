## Purpose

Provide a single, global control for the app-wide aggregation scope (git-worktree aggregation and jj
inclusion), living in the header rather than on the Changes page, and backed by each host's native
preference storage.

## Requirements

### Requirement: Global aggregation-scope control

The system SHALL present a single aggregation-scope control in the global application header
(alongside the theme toggle), reachable from every page, in **both** the Web app and the VS Code
webview. The control SHALL be a three-state selector — **current directory** / **git worktrees** /
**git worktrees + jj workspaces** — that sets the app-wide aggregation scope consumed by the Changes
list, the Overview, the Graph, the Timeline, and the live-reload watcher. At desktop width the control
SHALL render as a segmented control; on narrow viewports it MAY collapse to a compact select carrying
the same options.

#### Scenario: Control is available from any page

- **WHEN** a repository is selected and the user is on any page (Overview, Graph, Timeline, or Changes)
- **THEN** the aggregation-scope control is present in the header

#### Scenario: Changing scope affects every consumer

- **WHEN** the user changes the scope from the header while viewing the Overview
- **THEN** the Overview counts, and subsequently the Changes / Graph / Timeline views, reflect the new
  scope

### Requirement: Per-host preference storage

The control's preference SHALL be read from and written to each host's native storage, abstracted
behind the adapter's `getAggregationPrefs()` / `setAggregationPrefs()` methods. On the Web host the
storage SHALL be the browser `localStorage` preferences. In the VS Code webview the storage SHALL be
the VS Code settings, such that setting the control is equivalent to editing `settings.json` and an
external settings change updates the control. The scope SHALL map to a single level so that the
contradictory combination "aggregation off + jj on" is **unrepresentable**, and selecting the
current-directory level SHALL force jj off.

#### Scenario: Web persists to localStorage

- **WHEN** the user selects a scope in the Web app and reloads
- **THEN** the previously selected scope is restored from `localStorage`

#### Scenario: VS Code toggle equals editing settings

- **WHEN** the user selects a scope from the header in the VS Code webview
- **THEN** the corresponding `spek.aggregateWorktrees` / `spek.aggregateJjWorkspaces` settings are
  updated, exactly as if the user had edited `settings.json`

#### Scenario: VS Code settings edit updates the control

- **WHEN** the `spek.aggregateWorktrees` or `spek.aggregateJjWorkspaces` setting is changed externally
  (settings file or Settings UI) while the webview is open
- **THEN** the header control reflects the new value

#### Scenario: Invalid combination unrepresentable

- **WHEN** the current-directory scope is selected
- **THEN** the persisted preferences are aggregation off and jj off

### Requirement: Aggregation-scope control visibility

The control SHALL be shown only when a repository is selected AND there is something to aggregate —
more than one worktree is detected OR jj workspaces are available. The **worktrees + jj** option SHALL
be offered only when jj workspaces are detected; otherwise the control degrades to current directory /
worktrees. A plain single-worktree, non-jj repository SHALL show no control.

#### Scenario: Hidden for a single-worktree non-jj repo

- **WHEN** the repository has a single git worktree and no jj workspaces
- **THEN** no aggregation-scope control is shown

#### Scenario: jj option offered only when jj is present

- **WHEN** the repository has jj workspaces available
- **THEN** the control offers the worktrees + jj option
- **AND WHEN** no jj workspaces are present, that option is not offered

### Requirement: Worktree data for the header control

The header control SHALL obtain the detected worktree list from an app-level context that fetches it
via the `getWorktrees()` adapter method — not by scanning changes — with jj discovery enabled so the
jj option can be offered even when jj is currently disabled, and SHALL refresh it on the
live-reload / refresh signal so that adding or removing a worktree updates the control.

#### Scenario: Worktree data fetched without scanning changes

- **WHEN** the app loads with a repository selected
- **THEN** the context obtains the worktree list via `getWorktrees()` and does not depend on the
  Changes-list fetch

#### Scenario: Worktree list refreshes on the refresh signal

- **WHEN** a refresh or live-reload signal fires after a worktree is added
- **THEN** the context re-fetches the worktree list and the control updates accordingly
