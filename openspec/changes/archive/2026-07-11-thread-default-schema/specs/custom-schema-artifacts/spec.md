## MODIFIED Requirements

### Requirement: Surface the schema name per change
Because different changes in the same repo can declare different schemas, the system SHALL expose the schema name a change was authored under (from its `.openspec.yaml` `schema:` field, falling back to the repo's `openspec/config.yaml` `schema:`) on both `ChangeInfo` and `ChangeDetail`. The system SHALL also expose, per change, the **default** schema resolved against that change's own worktree (the `openspec/config.yaml` `schema:` value of the worktree the change was scanned from, read directly without invoking the OpenSpec CLI) as a `defaultSchema` field on `ChangeInfo` and on `ChangeDetail`; when a change's worktree has no determinable default, its `defaultSchema` SHALL be null. So that a single per-scan value stays available for repo-level headers, the system SHALL additionally expose the main worktree's default schema as `defaultSchema` on the changes response (`ChangesData`); when the main worktree has no determinable default, `ChangesData.defaultSchema` SHALL be null. Within a single scan the repo default SHALL be read at most once per worktree and reused for every change in that worktree rather than re-read per change.

The UI SHALL display a change's schema as a badge on every surface that represents a change — the Change Detail header, the Changes list rows, and the Dashboard change rows. To avoid noise in single-schema repos, the badge SHALL be hidden whenever the change's schema is null OR equals **that change's own** `defaultSchema` (from `ChangeInfo`/`ChangeDetail`); it SHALL be shown only when the change's schema is known and differs from its own default. This per-change hide rule SHALL be applied uniformly across all three surfaces, so that a change shows the same badge state in the list, on the Dashboard, and on its detail page regardless of which worktree it was aggregated from. So that the repo's baseline schema stays legible right where the divergent-schema badges appear, the Changes page SHALL display a `Default schema: <name>` indicator as a subheading beneath the page heading when `ChangesData.defaultSchema` is non-null, and SHALL omit it entirely when it is null. To keep the badge an unambiguous signal of divergence, the default-schema indicator SHALL be rendered as plain text rather than the pill/badge token used for divergent-schema change badges.

#### Scenario: Change detail shows a non-default schema
- **WHEN** a change's `.openspec.yaml` declares `schema: superpowers-bridge` and the repo default is `spec-driven`
- **THEN** `ChangeDetail.schema` equals `"superpowers-bridge"` and the change detail page displays that schema as a badge

#### Scenario: Different changes show different schemas
- **WHEN** one change declares `schema: spec-driven` and another declares `schema: superpowers-bridge`
- **THEN** each change reports its own schema name independently

#### Scenario: Schema falls back to repo config
- **WHEN** a change has no `schema:` in its `.openspec.yaml` but the repo `openspec/config.yaml` declares `schema: spec-driven`
- **THEN** the change's reported schema is `"spec-driven"` and its `defaultSchema` is `"spec-driven"`

#### Scenario: Badge appears in list views for a differing schema
- **WHEN** the Changes list or the Dashboard renders a change whose schema differs from its own `defaultSchema`
- **THEN** that change's row displays the schema badge alongside its other row metadata

#### Scenario: Badge hidden when schema equals the change's own default
- **WHEN** any surface (Change Detail, Changes list, or Dashboard) renders a change whose schema equals that change's own `defaultSchema`
- **THEN** no schema badge is shown for that change

#### Scenario: Non-default badge survives in a non-spec-driven repo
- **WHEN** a change's own `defaultSchema` is `agent-driven` and another change declares `schema: spec-driven`
- **THEN** the badge is hidden for the change whose schema is `agent-driven` and shown for the `spec-driven` change

#### Scenario: Aggregated change compares against its own worktree default
- **WHEN** worktree B's `openspec/config.yaml` declares `schema: agent-driven`, a change in worktree B declares no schema of its own (so its `schema` and `defaultSchema` both resolve to `"agent-driven"`), and the aggregated Changes list is rendered alongside the main worktree whose default is `spec-driven`
- **THEN** no schema badge is shown for that change, because its `schema` equals its own `defaultSchema` — even though it differs from the main worktree's `spec-driven` default

#### Scenario: List and detail agree for an aggregated change
- **WHEN** a change is rendered both in the aggregated Changes list and on its own detail page
- **THEN** the badge is shown in both places or hidden in both places, because both surfaces compare the change's `schema` against the same per-change `defaultSchema`

#### Scenario: Changes page shows the repo default schema
- **WHEN** the Changes page renders and `ChangesData.defaultSchema` is `"spec-driven"`
- **THEN** the Changes page displays a `Default schema: spec-driven` subheading with the schema name as plain text (not the pill badge)

#### Scenario: Changes page omits the label when no default is known
- **WHEN** the Changes page renders and `ChangesData.defaultSchema` is null
- **THEN** no default-schema subheading is shown
