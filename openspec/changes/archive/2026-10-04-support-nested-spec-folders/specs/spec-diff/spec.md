# Spec Delta

## ADDED Requirements

### Requirement: Read a nested spec at a change version
Version reads and comparison actions SHALL use the spec's full topic path to locate a delta within an active or archived change. A delta for a parent topic or a same-named topic in another folder SHALL not substitute for a missing version.

#### Scenario: Compare nested archived version
- **WHEN** an archived change contains `specs/contracts/pagination/streaming-search/spec.md` and the user compares that spec with its current content
- **THEN** the returned version is the nested delta's content and the diff compares it with the matching current spec

#### Scenario: Parent delta is not a child version
- **WHEN** a change contains `specs/contracts/pagination/spec.md` but no child delta
- **THEN** requesting that change's version of `contracts/pagination/streaming-search` returns not found
