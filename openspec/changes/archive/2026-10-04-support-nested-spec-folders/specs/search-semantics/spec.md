# Spec Delta

## ADDED Requirements

### Requirement: Nested main specs are distinct search documents
The searchable spec corpus SHALL include one document for every main `spec.md` at any depth, identified by its full relative topic path. Search results SHALL carry and display that full topic, so identically named specs in different folders remain distinct. Change delta specs SHALL remain excluded from the search corpus.

#### Scenario: Two nested specs share a basename
- **WHEN** `contracts/pagination` and `guides/pagination` both contain the search term
- **THEN** search returns two separately navigable spec results with those full topics

#### Scenario: Nested delta is not searched
- **WHEN** a term appears only in a nested change delta spec
- **THEN** searching that term does not return a result for that change

#### Scenario: Host parity
- **WHEN** the same nested corpus and query are searched in the web server, VS Code host, IntelliJ server, and static build
- **THEN** all surfaces return the same spec topics in the search contract's order
