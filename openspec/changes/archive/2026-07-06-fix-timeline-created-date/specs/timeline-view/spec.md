## MODIFIED Requirements

### Requirement: Handle changes without created date
The timeline SHALL gracefully degrade for changes missing `createdDate` rather than guessing.

#### Scenario: Missing createdDate listed separately
- **WHEN** one or more changes have `createdDate === null`
- **THEN** they are omitted from the time axis area
- **AND** an `Unknown created (N)` section lists them with clickable links to detail

#### Scenario: All changes missing createdDate
- **WHEN** every change has `createdDate === null`
- **THEN** the page shows a neutral empty-state message stating that no created dates are available for these changes
- **AND** the message SHALL NOT assert that the user omitted `created:` frontmatter, since the field may be present in the file but not surfaced by the backend
