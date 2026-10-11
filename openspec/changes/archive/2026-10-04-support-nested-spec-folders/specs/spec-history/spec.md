# Spec Delta

## ADDED Requirements

### Requirement: Nested spec history uses exact topic identity
The history and related-change lists for a spec SHALL include only active or archived changes containing a delta at the spec's exact full topic path. Topics sharing a final path segment or a parent path SHALL remain independent. Existing history fields and ordering SHALL be preserved.

#### Scenario: Parent and child histories remain separate
- **WHEN** one change contains `specs/contracts/pagination/spec.md` and another contains `specs/contracts/pagination/streaming-search/spec.md`
- **THEN** history for `contracts/pagination` contains only the first change
- **AND** history for `contracts/pagination/streaming-search` contains only the second change

#### Scenario: Same basename in different folders
- **WHEN** changes affect `contracts/pagination` and `guides/pagination` separately
- **THEN** each spec's history includes only changes at its own full path
