## ADDED Requirements

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
