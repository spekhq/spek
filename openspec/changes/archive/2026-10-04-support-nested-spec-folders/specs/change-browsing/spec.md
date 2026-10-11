# Spec Delta

## ADDED Requirements

### Requirement: Change details preserve nested delta topics
The Specs tab SHALL include delta specs at any depth and display each one's full topic path. Topic links and heading anchors SHALL distinguish parent and child topics and same-named specs in different folders. Inline capability IDs in proposal text SHALL link to a spec only when the full ID matches an available main spec.

#### Scenario: Nested delta appears in Specs tab
- **WHEN** a change contains `specs/contracts/pagination/spec.md` and `specs/contracts/pagination/streaming-search/spec.md`
- **THEN** both delta specs appear with their distinct full topic headers

#### Scenario: Nested headings have distinct anchors
- **WHEN** two nested delta specs contain the same requirement heading
- **THEN** each TOC entry reaches the heading under its own full-topic-prefixed anchor

#### Scenario: Full capability ID in proposal links to spec
- **WHEN** proposal inline code contains `contracts/pagination/streaming-search` and that main spec exists
- **THEN** the inline code links to that spec's detail page
