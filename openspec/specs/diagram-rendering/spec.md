## Purpose

Draws the diagrams that OpenSpec content carries as Mermaid source, so that a picture an author wrote as
a picture is shown as one. It states where diagram source is recognised, which surfaces draw it and which
show its source, how a drawn diagram is themed, what a reader can do with one that does not fit, and what
is shown when one cannot be drawn.

## Requirements

### Requirement: Diagram source is recognised in the two places OpenSpec content puts it

The system SHALL treat text as diagram source in exactly two places: a fenced code block in a Markdown
document whose info string declares the language `mermaid`, and a regular file at a change's root whose
extension is `.mmd` or `.mermaid`.

The language SHALL be matched case-insensitively, as fence info strings are authored inconsistently and
a diagram that renders on the host a reader came from must not render as source here. No other fence
language and no other extension SHALL be read as diagram source; in particular, diagram source SHALL NOT
be detected by inspecting the content of a block that declares no language, because a viewer that guesses
at meaning shows the reader something the document does not say.

Recognition SHALL apply wherever the renderer is used, so a diagram in a proposal, in a design document,
in a delta spec, in a main spec and in a tasks document is drawn on the same terms.

#### Scenario: A mermaid fence in a design document is drawn

- **WHEN** a change's `design.md` contains a fenced block whose info string is `mermaid`
- **THEN** the block is drawn as a diagram rather than displayed as source

#### Scenario: The fence language is matched regardless of case

- **WHEN** a fenced block declares its language as `Mermaid` or `MERMAID`
- **THEN** it is drawn as a diagram

#### Scenario: A diagram in spec content is drawn

- **WHEN** a main spec or a change's delta spec contains a `mermaid` fence
- **THEN** it is drawn as a diagram, on the same terms as one in a proposal

#### Scenario: Another language is not drawn

- **WHEN** a fenced block declares a language other than `mermaid`
- **THEN** it renders as a code block, syntax-highlighted as before

#### Scenario: Diagram text is not detected without a declaration

- **WHEN** a fenced block declares no language and its text happens to begin `graph TD`
- **THEN** it renders as a plain code block and is not drawn

### Requirement: A drawn diagram keeps its source reachable

Where a diagram has been drawn, a reader SHALL be able to see the source it was drawn from, through a
control on the diagram itself, and SHALL be able to return to the drawn form.

spek is a viewer of files. A drawn diagram is an interpretation of one, and the interpretation can be
wrong, unreadable at the size available, or simply less useful than the text to a reader who is about to
edit it. Making the source reachable costs one control; making it unreachable makes the file less visible
in spek than in a plain text editor.

When the source is shown it SHALL be shown as the file holds it, unreformatted, and SHALL be selectable
so it can be copied.

#### Scenario: Source is reachable from a drawn diagram

- **WHEN** a reader activates the source control on a drawn diagram
- **THEN** the diagram's Mermaid source is displayed in place of the drawing

#### Scenario: The drawing is reachable again

- **WHEN** a reader activates the control again while the source is shown
- **THEN** the diagram is displayed in its drawn form

#### Scenario: Source is shown verbatim

- **WHEN** a diagram's source is displayed
- **THEN** the text shown is the source as authored, with no reformatting, and it can be selected

### Requirement: A diagram that cannot be drawn reports the failure and shows its source

When diagram source cannot be drawn — it does not parse, or the drawing code cannot be loaded — the
system SHALL show that the diagram could not be drawn, SHALL include the reason reported to it, and SHALL
show the source.

The rest of the document SHALL render normally, and a second diagram in the same document SHALL be
unaffected by the first one's failure. A failure SHALL NOT remove the page: the artifact a reader
navigated to stays on screen, with its other content intact.

A failure message SHALL be presented as a message about the document, not as an application error. An
invalid diagram is a fact about the file the reader is reading, which is the thing spek exists to show
them.

#### Scenario: A diagram that does not parse

- **WHEN** a `mermaid` fence contains text Mermaid cannot parse
- **THEN** the block shows that it could not be drawn, shows the reported reason, and shows the source

#### Scenario: The surrounding document is unaffected

- **WHEN** a document contains an unparseable diagram followed by further headings and prose
- **THEN** all of that content renders normally

#### Scenario: One failure does not affect another diagram

- **WHEN** a document contains an unparseable diagram and a valid one
- **THEN** the valid one is drawn

#### Scenario: The drawing code cannot be loaded

- **WHEN** the diagram implementation fails to load
- **THEN** each diagram on the page shows that it could not be drawn, with its source, and the page stays usable

### Requirement: A diagram larger than the space available can be examined

On a surface that draws, a diagram SHALL remain examinable when it is larger than the width available to it. A reader SHALL be
able to magnify it and to move around it, and SHALL be able to return it to the size at which it was
first shown.

A diagram SHALL NOT widen the page: the horizontal overflow of an oversized diagram SHALL be contained
within the diagram, as it already is for tables and code blocks, so that no document scrolls sideways
because of one.

This obligation is strongest exactly where it is easiest to miss — the VS Code and IntelliJ panels and a
phone are all narrow, and an architecture diagram authored at desktop width is unreadable in all three.

#### Scenario: An oversized diagram can be magnified and moved

- **WHEN** a drawn diagram is wider than the space available
- **THEN** the reader can magnify it and move around it within the diagram's own area

#### Scenario: The original view can be restored

- **WHEN** a reader has magnified or moved a diagram
- **THEN** a control returns it to the view it was first shown at

#### Scenario: A diagram does not widen the page

- **WHEN** a document containing an oversized diagram is rendered at a narrow width
- **THEN** the page itself does not scroll horizontally

### Requirement: A diagram is drawn in the colours of the active theme

Where a diagram is drawn, it SHALL be drawn in colours taken from the application's own theme, in the theme that is active,
rather than in the drawing library's default palette. When the active theme changes, diagrams on the page
SHALL be redrawn in the new theme's colours.

Every colour a diagram applies SHALL answer to the project's palette obligation: text drawn in a diagram —
node labels, edge labels, legends — meets the text floor, and a line or fill that is the only carrier of
its meaning meets the graphic floor. A diagram states structure through colour and line, so its marks
are information, not decoration.

A drawing library ships a palette chosen against its own assumed background. Accepting it puts an
uncontrolled set of colours on a themed page: on this project's light theme that is how a diagram ends up
unreadable while every check still passes, because the colours never appear in the application's own
source. Sourcing them from the theme is what makes them checkable at all.

#### Scenario: A diagram matches the active theme

- **WHEN** a diagram is drawn with the light theme active and again with the dark theme active
- **THEN** each drawing uses that theme's colours rather than one palette shared by both

#### Scenario: Diagrams follow a theme change

- **WHEN** the reader switches theme while a drawn diagram is on screen
- **THEN** the diagram is redrawn in the newly active theme's colours

#### Scenario: Diagram text meets the text floor

- **WHEN** a diagram's labels are drawn in either theme
- **THEN** each meets the project's contrast floor for text against the surface it is drawn on

#### Scenario: A meaning-bearing line meets the graphic floor

- **WHEN** a diagram draws an edge or a node border that carries meaning
- **THEN** it meets the project's contrast floor for a graphic that is the sole carrier of its information

### Requirement: Diagram source is treated as untrusted input

Diagram source SHALL be rendered under the drawing library's strictest sanitization setting, so that
markup or script embedded in a diagram's labels cannot execute.

Diagram source arrives from a repository the reader has pointed spek at, and is rendered by hosts that
have more privilege than a browser tab: the VS Code and IntelliJ webviews run inside the editor. The
project's standing rule is that spek reads content and never executes it, and a diagram is content.

Drawing a diagram SHALL NOT require relaxing a host's content security policy — in particular it SHALL
NOT require permitting dynamic code evaluation.

#### Scenario: Markup in a diagram label does not execute

- **WHEN** a diagram's label text contains HTML or a script element
- **THEN** it is not executed, and nothing it declares is added to the page as markup

#### Scenario: Hosts keep their content security policy

- **WHEN** a diagram is drawn in the VS Code webview
- **THEN** it draws under the policy the host already sets, with no relaxation for dynamic code evaluation

### Requirement: Whether a surface draws is a property of that surface, and the source is the floor

Drawing SHALL be a capability a build either has or does not have, decided when the build is made rather
than discovered at view time.

A surface that does **not** draw SHALL show the diagram's source. It SHALL present that as the ordinary
way that surface shows a diagram, and SHALL NOT present it as an error, a degraded mode or a failure to
load: nothing has gone wrong, and the source is the file the reader came to read. The controls offered
SHALL match what is actually available — a surface with no drawing to switch to SHALL NOT offer a switch
that leads nowhere.

This exists because the constraint is a build format, not a host. A surface that can split code draws:
the drawing implementation arrives as a chunk fetched only when a document holds a diagram, so a reader
who opens no diagram downloads none of it. The Web app, the VS Code webview and the IntelliJ tool window
are all of that kind — a webview can load further files from its own resource root, and the IntelliJ
built-in server already serves them.

`docs/demo.html` is the exception, and the reason is not the host but the artifact: it is a **single
self-contained file**, committed to the repository on every release. It cannot split, so the
implementation would be inlined — measured at 5.23 MB on top of a 719 KB bundle. Showing the source
there is a smaller product, honestly stated, rather than a bug.

The drawing implementation SHALL be absent from the bundles of surfaces that do not draw, not merely
unused by them. An implementation that ships and is never called costs exactly what it would cost if it
were called, which is the entire reason this requirement exists.

#### Scenario: A surface that can split code draws

- **WHEN** a document containing a diagram is viewed on the Web app, the VS Code webview or the IntelliJ tool window
- **THEN** the diagram is drawn

#### Scenario: A single-file surface shows the source

- **WHEN** a document containing a diagram is viewed in `docs/demo.html`
- **THEN** the diagram's source is shown, verbatim and selectable

#### Scenario: Not drawing is not reported as a failure

- **WHEN** a diagram is shown on a surface built without drawing
- **THEN** nothing indicates an error, a failed load or a degraded state

#### Scenario: No control leads nowhere

- **WHEN** a diagram is shown on a surface built without drawing
- **THEN** no control offers to switch to a drawing, there being none

#### Scenario: The implementation is absent, not merely unused

- **WHEN** a surface that does not draw is built
- **THEN** its bundle does not contain the drawing implementation

### Requirement: The drawing implementation is loaded only when a diagram is present

On a surface that draws, the drawing implementation SHALL be requested only when a diagram is actually
rendered, so that a repository containing no diagrams pays nothing at runtime for this capability.

It SHALL be loaded from within the application, never fetched from a third-party host at view time. The
demo is a single self-contained file that issues no external request, the VS Code and IntelliJ webviews
render from local resources under a restrictive policy, and a viewer that reaches the network to display
a local file is a different product from the one this is.

#### Scenario: A document with no diagram does not load the implementation

- **WHEN** a change's artifacts contain no diagram source and its tabs are viewed
- **THEN** the drawing implementation is not requested

#### Scenario: The first diagram loads it

- **WHEN** a document containing a diagram is rendered on a surface that draws
- **THEN** the drawing implementation is loaded and the diagram is drawn

#### Scenario: No external request is made

- **WHEN** `docs/demo.html` is opened from disk, or a diagram is drawn in either editor host
- **THEN** it renders from resources the build ships, and no request is issued to any external host
