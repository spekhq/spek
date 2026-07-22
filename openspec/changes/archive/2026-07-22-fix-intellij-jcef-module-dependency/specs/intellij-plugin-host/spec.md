## ADDED Requirements

### Requirement: Tool Window construction survives an unavailable embedded browser
Creating the Tool Window content SHALL NOT fail because the embedded browser cannot be created. On every supported IDE
build, the Tool Window SHALL be constructed and populated regardless of whether JCEF is present, and no exception or
error originating from the embedded browser may escape Tool Window content creation.

#### Scenario: JCEF unavailable on a supported IDE
- **WHEN** the Tool Window is opened on a supported IDE build where JCEF cannot be resolved or is unsupported
- **THEN** the Tool Window SHALL be created with the tree navigator and the external-browser fallback panel
- **AND** no IDE Internal Error SHALL be reported

#### Scenario: JCEF available on a supported IDE
- **WHEN** the Tool Window is opened on a supported IDE build where JCEF is available
- **THEN** the Tool Window SHALL display the embedded webview, not the fallback panel
- **AND** theme synchronization and tree-driven navigation SHALL operate against the embedded webview
