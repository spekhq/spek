## ADDED Requirements

### Requirement: YAML frontmatter parsing tolerates line-ending styles
The scanner's `.openspec.yaml` frontmatter parser SHALL correctly extract the `created` field regardless of the file's line-ending style, so that `createdDate` is not lost for files using CRLF (`\r\n`) line endings. Parsing SHALL split content on both `\r\n` and `\n`, leaving no trailing carriage return that would prevent the `created` value from matching.

#### Scenario: CRLF line endings preserve createdDate
- **WHEN** a change's `.openspec.yaml` uses CRLF (`\r\n`) line endings and contains `created: 2026-07-05`
- **THEN** the corresponding `ChangeInfo.createdDate` SHALL equal the string `"2026-07-05"`

#### Scenario: LF line endings remain unaffected
- **WHEN** a change's `.openspec.yaml` uses LF (`\n`) line endings and contains `created: 2026-07-05`
- **THEN** the corresponding `ChangeInfo.createdDate` SHALL equal the string `"2026-07-05"`
