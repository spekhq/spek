## ADDED Requirements

### Requirement: Delta spec base content
The single-change read SHALL carry, for an active change, a `base` on each entry of its `specs` artifact: the raw
content of the main spec of the same topic in the working directory the change was read from (the `wt` worktree
when given), resolved by the same rule as a spec read, or `null` when that topic has no main spec. For an archived
change, `base` SHALL be absent or `null`, and a consumer SHALL NOT read it: the change's status, not this field,
says whether a base applies. The field is additive; existing fields SHALL be unchanged. The IntelliJ embedded
server SHALL return the same field.

#### Scenario: Active change with an existing main spec
- **WHEN** an active change has a delta spec for topic `search` and `openspec/specs/search/spec.md` exists
- **THEN** that delta entry's `base` is the content of `openspec/specs/search/spec.md`

#### Scenario: Active change introducing a new topic
- **WHEN** an active change has a delta spec for topic `billing` and there is no main spec for `billing`
- **THEN** that delta entry's `base` is `null`

#### Scenario: Change read from a worktree
- **WHEN** the change is read with `wt` naming a worktree
- **THEN** each `base` is read from that worktree's `openspec/specs/`

#### Scenario: Archived change
- **WHEN** an archived change is read
- **THEN** its delta entries carry no base content
