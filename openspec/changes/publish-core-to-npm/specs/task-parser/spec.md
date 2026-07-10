## MODIFIED Requirements

### Requirement: Parse task checkboxes
The task parser SHALL be a pure function in the `@spekjs/core` package that reads a tasks.md content string and extracts checkbox items with their completion status. It SHALL have no dependency on Express or any HTTP framework.

#### Scenario: Parse file with mixed checkboxes
- **WHEN** parser receives a string containing `- [x] Done task` and `- [ ] Pending task`
- **THEN** it returns each task with `text` and `completed` (boolean) fields
