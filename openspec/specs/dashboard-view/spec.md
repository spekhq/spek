## Purpose

Provide the Dashboard landing page that aggregates spec, change, and task statistics into an at-a-glance entry point for a repository.

## Requirements

### Requirement: Overview statistics display
The system SHALL display overview statistics from the overview API: total specs count, active changes count, archived changes count, and task completion rate (percentage). Statistics SHALL be displayed in stat cards with large numbers (text-4xl) and a staggered fade-in-up entry animation on page load.

#### Scenario: Display statistics
- **WHEN** user navigates to the Dashboard page
- **THEN** system displays specs count, active changes count, archived changes count, and overall task completion percentage in stat cards with large accent-colored numbers

#### Scenario: Staggered entry animation
- **WHEN** the Dashboard page loads
- **THEN** the four stat cards appear with a fade-in-up animation, each card delayed by an incremental amount (e.g., 0ms, 80ms, 160ms, 240ms) creating a staggered reveal effect

#### Scenario: Reduced motion preference
- **WHEN** user has `prefers-reduced-motion: reduce` enabled
- **THEN** stat cards appear immediately without animation

### Requirement: Active changes list
The system SHALL display a list of active changes with their names and task progress indicators.

#### Scenario: Show active changes with progress
- **WHEN** there are active changes in the repo
- **THEN** each active change is displayed with its name and a TaskProgress bar showing completed/total tasks

#### Scenario: No active changes
- **WHEN** there are no active changes
- **THEN** system displays an empty state message

### Requirement: Recent archived changes
The system SHALL display the most recent 10 archived changes. Each change SHALL display a relative time indicator (e.g., "3 hours ago", "2 days ago") when a git timestamp is available, with the full ISO timestamp shown as a tooltip on hover. When no git timestamp is available, the system SHALL fall back to displaying the slug date in YYYY-MM-DD format.

#### Scenario: Show archived changes with timestamp
- **WHEN** user views the Dashboard and archived changes have git timestamps
- **THEN** the most recent 10 archived changes are listed with their names and relative time (e.g., "3 hours ago")
- **AND** hovering over the time shows the full ISO timestamp as a tooltip

#### Scenario: Show archived changes without timestamp
- **WHEN** user views the Dashboard and archived changes have no git timestamp
- **THEN** the changes are listed with their names and slug date in YYYY-MM-DD format

### Requirement: Navigation cards
The system SHALL provide navigation cards/links to the Specs list and Changes list pages.

#### Scenario: Navigate to specs
- **WHEN** user clicks the Specs navigation card
- **THEN** system navigates to `/specs`

#### Scenario: Navigate to changes
- **WHEN** user clicks the Changes navigation card
- **THEN** system navigates to `/changes`

### Requirement: Lifecycle statistics cards
The Dashboard SHALL display two additional statistics cards related to change lifecycle, alongside the existing overview statistics cards:

- **Avg lifecycle (archived)**: the average number of days between `createdDate` and `archivedDate` across all archived changes that have both fields populated, rounded to the nearest integer. The card SHALL display the value with a trailing `d` suffix (e.g., `10d`). When the average is greater than 0 but less than 1 (sub-day turnaround), the card SHALL display `<1d` instead of `0d` to avoid being mistaken for missing data. When no archived change has both fields populated, the card SHALL display `—` (em dash).
- **Stale active (>30d)**: the count of active changes whose `createdDate` is more than 30 days before today. Active changes with `createdDate: null` SHALL be excluded from the count. When the count is zero, the card SHALL display `0`.

Both cards SHALL adopt the same visual style as the existing overview statistics cards (large accent-colored number, label, staggered fade-in-up animation) and SHALL participate in the staggered entry animation sequence.

#### Scenario: Average lifecycle calculation
- **WHEN** the repo has 3 archived changes with both `createdDate` and `archivedDate` such that lifecycle spans are 5, 10, and 15 days
- **THEN** the `Avg lifecycle (archived)` card displays `10d`

#### Scenario: Average lifecycle rounds to nearest integer
- **WHEN** the repo has 2 archived changes with lifecycle spans 4 and 7 days (average 5.5)
- **THEN** the `Avg lifecycle (archived)` card displays `6d`

#### Scenario: Sub-day average shows <1d
- **WHEN** the repo has archived changes whose lifecycle spans average between 0 and 1 days (e.g., 41 changes at 0d, 11 at 1d, 2 at 2d → 0.28d average)
- **THEN** the `Avg lifecycle (archived)` card displays `<1d` (not `0d`)

#### Scenario: No archived changes with both lifecycle dates
- **WHEN** no archived change has both `createdDate` and `archivedDate` populated
- **THEN** the `Avg lifecycle (archived)` card displays `—`

#### Scenario: Stale active count
- **WHEN** the repo has 2 active changes whose `createdDate` is more than 30 days before today, and 3 active changes within 30 days
- **THEN** the `Stale active (>30d)` card displays `2`

#### Scenario: Active changes without createdDate excluded
- **WHEN** the repo has 1 active change with `createdDate: null` (regardless of git timestamp)
- **THEN** that change SHALL NOT be counted in the `Stale active (>30d)` card

#### Scenario: No stale active changes
- **WHEN** no active change has `createdDate` more than 30 days before today
- **THEN** the `Stale active (>30d)` card displays `0`

#### Scenario: Lifecycle cards participate in staggered animation
- **WHEN** the Dashboard page loads
- **THEN** the lifecycle statistics cards appear with the same fade-in-up animation as existing stat cards, with their entry delays continuing the staggered sequence
