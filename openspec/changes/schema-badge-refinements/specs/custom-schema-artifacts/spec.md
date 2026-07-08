## MODIFIED Requirements

### Requirement: Surface the schema name per change
Because different changes in the same repo can declare different schemas, the system SHALL expose the schema name a change was authored under (from its `.openspec.yaml` `schema:` field, falling back to the repo's `openspec/config.yaml` `schema:`) on both `ChangeInfo` and `ChangeDetail`. The system SHALL also expose the repo's **default** schema (the `openspec/config.yaml` `schema:` value, read directly without invoking the OpenSpec CLI) to views as `defaultSchema` on the changes response (`ChangesData`) and on `ChangeDetail`; when the repo has no determinable default, `defaultSchema` SHALL be null.

The UI SHALL display a change's schema as a badge on every surface that represents a change — the Change Detail header, the Changes list rows, and the Dashboard change rows. To avoid noise in single-schema repos, the badge SHALL be hidden whenever the change's schema is null OR equals the repo `defaultSchema`; it SHALL be shown only when the change's schema is known and differs from the repo default. This hide rule SHALL be applied uniformly across all three surfaces. So that the repo's baseline schema stays legible right where the divergent-schema badges appear, the Changes page SHALL display a `Default schema: <name>` indicator as a subheading beneath the page heading when `defaultSchema` is non-null, and SHALL omit it entirely when `defaultSchema` is null. To keep the badge an unambiguous signal of divergence, the default-schema indicator SHALL be rendered as plain text rather than the pill/badge token used for divergent-schema change badges.

#### Scenario: Change detail shows a non-default schema
- **WHEN** a change's `.openspec.yaml` declares `schema: superpowers-bridge` and the repo default is `spec-driven`
- **THEN** `ChangeDetail.schema` equals `"superpowers-bridge"` and the change detail page displays that schema as a badge

#### Scenario: Different changes show different schemas
- **WHEN** one change declares `schema: spec-driven` and another declares `schema: superpowers-bridge`
- **THEN** each change reports its own schema name independently

#### Scenario: Schema falls back to repo config
- **WHEN** a change has no `schema:` in its `.openspec.yaml` but the repo `openspec/config.yaml` declares `schema: spec-driven`
- **THEN** the change's reported schema is `"spec-driven"`

#### Scenario: Badge appears in list views for a differing schema
- **WHEN** the Changes list or the Dashboard renders a change whose schema differs from the repo `defaultSchema`
- **THEN** that change's row displays the schema badge alongside its other row metadata

#### Scenario: Badge hidden when schema equals the repo default
- **WHEN** any surface (Change Detail, Changes list, or Dashboard) renders a change whose schema equals the repo `defaultSchema`
- **THEN** no schema badge is shown for that change

#### Scenario: Non-default badge survives in a non-spec-driven repo
- **WHEN** the repo `defaultSchema` is `agent-driven` and a change declares `schema: spec-driven`
- **THEN** the badge is hidden for changes whose schema is `agent-driven` and shown for the `spec-driven` change

#### Scenario: Changes page shows the repo default schema
- **WHEN** the Changes page renders and `ChangesData.defaultSchema` is `"spec-driven"`
- **THEN** the Changes page displays a `Default schema: spec-driven` subheading with the schema name as plain text (not the pill badge)

#### Scenario: Changes page omits the label when no default is known
- **WHEN** the Changes page renders and `defaultSchema` is null
- **THEN** no default-schema subheading is shown
