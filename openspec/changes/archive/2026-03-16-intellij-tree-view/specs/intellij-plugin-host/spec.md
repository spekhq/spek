## MODIFIED Requirements

### Requirement: Tool Window registration
The plugin SHALL register a Tool Window with id `spek` that appears in the IDE's right sidebar. The Tool Window SHALL display a vertical split pane containing the OpenSpec tree navigator on top and the JCEF webview content (or external browser fallback) on the bottom.

#### Scenario: Tool Window visibility
- **WHEN** a project with OpenSpec content is detected
- **THEN** a "spek" Tool Window icon SHALL appear in the right sidebar
- **AND** clicking the icon SHALL open/reveal the Tool Window with both the tree navigator and the webview
