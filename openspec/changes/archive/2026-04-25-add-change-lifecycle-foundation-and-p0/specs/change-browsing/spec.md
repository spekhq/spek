## MODIFIED Requirements

### Requirement: Change list with active/archived separation
The system SHALL display changes grouped into active and archived sections. Active changes SHALL be visually distinguished with a left accent color border (4px). Changes SHALL be sorted by git timestamp descending (most recent first), falling back to slug date when timestamp is unavailable. Each change row SHALL display a compact lifecycle indicator based on `createdDate` and `archivedDate` (label words like "Created" / "Archived" are intentionally omitted to reduce visual noise; the meaning is conveyed by date format and the `→` separator):

- Active changes with `createdDate` SHALL display `<short-date> · <N>d`, where `<short-date>` is the locale-independent month-day form (e.g., `Apr 20`) and `<N>` is the integer day count between `createdDate` and today.
- Archived changes with both `createdDate` and `archivedDate` SHALL display `<short-date> → <short-date> · <N>d`, where `<N>` is the day count between the two dates.
- When `createdDate` is null, the system SHALL fall back to displaying the relative git timestamp (e.g., `2 days ago`) when a git timestamp is available, or the slug date in `YYYY-MM-DD` format otherwise.

The full ISO `createdDate`, `archivedDate`, and git timestamp (when available) SHALL be exposed as tooltip content on hover (the tooltip retains the full labels for clarity).

#### Scenario: Display active changes
- **WHEN** user navigates to the ChangeList page and there are active changes
- **THEN** active changes are listed in an "Active" section with a left accent color border, name, and task progress

#### Scenario: Display archived changes
- **WHEN** user navigates to the ChangeList page
- **THEN** archived changes are listed in an "Archived" section sorted by timestamp descending, without accent border

#### Scenario: Active change row shows lifecycle
- **WHEN** an active change has `createdDate: "2026-04-20"` and today is `2026-04-25`
- **THEN** the row displays `Apr 20 · 5d`
- **AND** hovering reveals the full ISO `createdDate` and git timestamp (when available) as tooltip content (with `Created:` / `First commit:` labels)

#### Scenario: Archived change row shows lifecycle span
- **WHEN** an archived change has `createdDate: "2026-02-14"` and `archivedDate: "2026-02-22"`
- **THEN** the row displays `Feb 14 → Feb 22 · 8d`
- **AND** hovering reveals full ISO `createdDate` and `archivedDate` as tooltip content (with `Created:` / `Archived:` labels)

#### Scenario: Change without createdDate falls back to timestamp
- **WHEN** a change has `createdDate: null` but a git timestamp is available
- **THEN** the row falls back to the relative git timestamp display (e.g., `2 days ago`)
- **AND** hovering reveals the full ISO timestamp as tooltip content

#### Scenario: Change without createdDate or timestamp
- **WHEN** a change has both `createdDate: null` and no git timestamp
- **THEN** the row falls back to displaying the slug date in `YYYY-MM-DD` format

#### Scenario: No changes
- **WHEN** there are no changes in the repo
- **THEN** system displays an empty state message

## ADDED Requirements

### Requirement: Change detail lifecycle banner
The change detail page (`/changes/:slug`) SHALL display a lifecycle banner directly below the change title and above the tab navigation bar. The banner leads with the lifecycle duration (the most actionable information) and follows with the supporting dates:

- Active changes (with `createdDate` and no `archivedDate`) SHALL display `Active for <N> days · since <ISO date>`, where `<N>` is the day count between `createdDate` and today. When the day count is 0 (created today), the banner SHALL display `Active for <1 day` instead of `Active for 0 days`.
- Archived changes (with both `createdDate` and `archivedDate`) SHALL display `Lifecycle <N> days · <ISO createdDate> → <ISO archivedDate>`, where `<N>` is the day count between the two dates. When the span is 0 (same-day archive), the banner SHALL display `Lifecycle <1 day` instead of `Lifecycle 0 days`.
- When `createdDate` is null, no lifecycle banner SHALL be rendered.

The banner SHALL be visually distinct from the title (smaller font size, muted text color) and SHALL be included in the sticky header region so it remains visible while scrolling.

#### Scenario: Active change banner
- **WHEN** user views a change with `createdDate: "2026-04-20"`, no `archivedDate`, and today is `2026-04-25`
- **THEN** the banner displays `Active for 5 days · since 2026-04-20`

#### Scenario: Archived change banner
- **WHEN** user views a change with `createdDate: "2026-02-14"` and `archivedDate: "2026-02-22"`
- **THEN** the banner displays `Lifecycle 8 days · 2026-02-14 → 2026-02-22`

#### Scenario: Same-day archive banner
- **WHEN** user views a change with `createdDate: "2026-04-21"` and `archivedDate: "2026-04-21"` (same-day archive)
- **THEN** the banner displays `Lifecycle <1 day · 2026-04-21 → 2026-04-21`

#### Scenario: Active change created today shows <1 day
- **WHEN** user views an active change with `createdDate: "2026-04-25"` and today is `2026-04-25`
- **THEN** the banner displays `Active for <1 day · since 2026-04-25`

#### Scenario: Change without createdDate
- **WHEN** user views a change whose `createdDate` is null
- **THEN** no lifecycle banner is rendered, and the title connects directly to the tab navigation bar as before

#### Scenario: Banner stays sticky on scroll
- **WHEN** the lifecycle banner is rendered and the user scrolls through long change content
- **THEN** the banner SHALL remain visible as part of the sticky header region (alongside the title and tab navigation bar)
