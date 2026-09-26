# Spec Delta

## MODIFIED Requirements

### Requirement: Syntax highlighting for fenced code blocks
The system SHALL syntax-highlight fenced code blocks in rendered Markdown. It SHALL color the tokens by the language declared on the fence. Highlight colors SHALL be per-theme color tokens. Each highlight color SHALL meet the project's color-contrast obligation in the light theme and in the dark theme. Highlight colors SHALL NOT be shipped as untokenized literals. A code block whose fence declares no language SHALL render as plain, uncolored code, and SHALL raise no error. Highlighting SHALL NOT change the behavior that keeps BDD keywords unhighlighted inside code. Highlighting SHALL NOT weaken author emphasis. A `data` artifact renders through this same pipeline as a fenced block, so the highlighting SHALL apply to it and to code fences in other Markdown documents alike.

One declared language is an exception, and it is an exception to *what the block is*, not to how it is
coloured: a fence declaring `mermaid` is diagram source, and the renderer SHALL hand it to the diagram
capability rather than highlight it as code. Highlighting a diagram is not wrong so much as beside the
point — the reader is being shown the instructions for a picture instead of the picture. The exception is
stated here rather than left to the diagram capability alone, because a rule that says *every* fence with
a language is highlighted, contradicted in practice by one that is not, reads to the next person as a bug
in the highlighter.

The exception SHALL be confined to the delegation. A `mermaid` fence's source, wherever the diagram
capability puts it back on screen, SHALL be presented as the source of a diagram rather than as
highlighted code, and every other fence — including one whose language the highlighter does not
recognise — SHALL behave exactly as before.

#### Scenario: A language-tagged code block is highlighted
- **WHEN** MarkdownRenderer receives a fenced code block tagged with a language (for example ` ```json `)
- **THEN** the block's tokens are colored by that language's syntax

#### Scenario: Highlight colors meet the contrast obligation in both themes
- **WHEN** a highlighted code block renders in the light theme and in the dark theme
- **THEN** every highlight color applied to code text meets the project's contrast standard in that theme

#### Scenario: A code block with no language renders plainly
- **WHEN** MarkdownRenderer receives a fenced code block with no language hint
- **THEN** the block renders as plain, uncolored code
- **AND** no error is raised

#### Scenario: A data artifact renders as a highlighted block
- **WHEN** a `data` artifact's content renders as a fenced code block with the language from its file extension
- **THEN** the content is syntax-highlighted by the same mechanism as any other fenced code block

#### Scenario: A mermaid fence is delegated rather than highlighted
- **WHEN** MarkdownRenderer receives a fenced code block whose declared language is `mermaid`
- **THEN** the block is handed to the diagram capability and is not rendered as a highlighted code block

#### Scenario: An unrecognised language is unaffected by the exception
- **WHEN** MarkdownRenderer receives a fenced code block declaring a language the highlighter does not know
- **THEN** it renders as plain, uncolored code as before, and is not treated as diagram source
