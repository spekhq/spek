## MODIFIED Requirements

### Requirement: Changes TreeView
The sidebar SHALL display a TreeView listing changes from the OpenSpec repository, grouped by status (active and archived). Each item SHALL display the change slug name. When the change has a `createdDate`, the TreeItem SHALL set its `description` to a lifecycle hint:

- Active changes SHALL set `description` to `(<N>d)`, where `<N>` is the integer day count between `createdDate` and today.
- Archived changes (with both `createdDate` and `archivedDate`) SHALL set `description` to `→ archived (<N>d)`, where `<N>` is the day count between `createdDate` and `archivedDate`.

The TreeItem `tooltip` SHALL include `Created: <ISO date>` for any change with `createdDate`, and additionally `Archived: <ISO date>` for archived changes with `archivedDate`. Changes whose `createdDate` is null SHALL NOT have a lifecycle `description`, and the `tooltip` SHALL omit the corresponding line.

#### Scenario: Display changes with active and archived groups
- **WHEN** the workspace has both active and archived changes
- **THEN** the CHANGES section displays two groups: "Active" and "Archived", each containing their respective change items

#### Scenario: Display changes with only active changes
- **WHEN** the workspace has only active changes
- **THEN** the CHANGES section displays only the "Active" group

#### Scenario: Empty changes
- **WHEN** the workspace has no changes
- **THEN** the CHANGES section displays a welcome message indicating no changes found

#### Scenario: Active change shows lifecycle hint
- **WHEN** an active change has `createdDate: "2026-04-20"` and today is `2026-04-25`
- **THEN** the TreeItem's `description` is `(5d)`
- **AND** the `tooltip` includes the line `Created: 2026-04-20`

#### Scenario: Archived change shows lifecycle span
- **WHEN** an archived change has `createdDate: "2026-02-14"` and `archivedDate: "2026-02-22"`
- **THEN** the TreeItem's `description` is `→ archived (8d)`
- **AND** the `tooltip` includes the lines `Created: 2026-02-14` and `Archived: 2026-02-22`

#### Scenario: Change without createdDate shows no lifecycle hint
- **WHEN** a change has `createdDate: null`
- **THEN** the TreeItem's `description` is empty (no lifecycle hint)
- **AND** the `tooltip` does NOT include a `Created:` line
