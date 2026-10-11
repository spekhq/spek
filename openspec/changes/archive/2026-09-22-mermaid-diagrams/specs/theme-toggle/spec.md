# Spec Delta

## ADDED Requirements

### Requirement: A palette handed to a renderer that draws its own markup is accounted for where it is declared

Where the application hands a palette to a component that generates its own markup at view time, that
palette SHALL be enumerated as a mechanism by which colour reaches the screen, and each colour in it SHALL
be measured against the floor its use answers to or declared as owing nothing with the reason stated.

The enumeration the palette check maintains is built by reading the application's own source and
stylesheet. A palette handed to a renderer escapes it twice over: the colours are values in a
configuration object rather than a property on an element, and the elements they end up on do not exist
until a reader opens the page. Neither omission is visible — the check finds nothing to report, which is
indistinguishable from finding nothing wrong. This is the same failure the enumeration requirement already
records for SVG presentation attributes, arriving by a second route, and it arrives whenever a capability
is added by adopting a renderer rather than by writing markup.

The measurement SHALL therefore be made at the **declaration**: the set of colours the application hands
over, against the surface it hands them over for, in every theme. The check SHALL NOT be satisfied by the
absence of findings in generated output it cannot see.

A palette handed over SHALL be sourced from the project's own theme tokens. A literal colour in such a
palette is the same untokenized literal the palette obligation already forbids in a stylesheet, and it is
harder to find, so it SHALL be treated the same way.

Where the renderer's own defaults would apply to anything the application does not declare, the
application SHALL either declare it or state why the default owes nothing — an undeclared colour is the
library's palette on the project's page, chosen against a background that is not this one.

Where the renderer draws text on a fill it also draws, the text SHALL be measured against **every** fill
it can land on, not against the page. A renderer commonly reuses one text colour across several fills — a
gantt chart labels a normal bar and a critical bar with the same variable — and measuring it against the
page, or against only one of those fills, is how such a label sat below 2:1 while the check passed.
A renderer setting that changes the colour actually drawn, such as a fill opacity that blends a mark into
the page, SHALL be set so that the drawn colour is the measured one.

Where hue is the only thing distinguishing marks — a pie chart, whose legend names each slice by its
colour alone — those marks SHALL take their colours from a **categorical ramp** of theme tokens, in which
each hue clears the non-text floor against every surface and any label drawn on it clears the text floor,
in every theme. Colours derived from the surface palette SHALL NOT be used for such marks: derivation from
surfaces converges, and every slice drew the same near-black in the dark theme and near-white in the light.

#### Scenario: A handed-over palette is measured

- **WHEN** the application hands a set of colours to a renderer that generates its own markup
- **THEN** each colour in that set is measured against the floor its use answers to, in every theme, or declared as owing nothing with its reason

#### Scenario: A literal in a handed-over palette fails the check

- **WHEN** a colour in such a palette is written as a literal rather than sourced from a theme token
- **THEN** the check fails, as it does for an untokenized literal anywhere else

#### Scenario: Relying on the renderer's defaults is not an answer

- **WHEN** a colour the renderer would supply from its own defaults is neither declared by the application nor stated as owing nothing
- **THEN** the check fails rather than passing on the absence of a finding

#### Scenario: Text on the renderer's own fills is measured on each of them

- **WHEN** the renderer draws one text colour on more than one fill, such as a label inside a normal and a critical gantt bar
- **THEN** that text colour is measured against each of those fills, and the check fails if any of them falls below the text floor

#### Scenario: A pie chart's slices can be told apart

- **WHEN** a pie chart with up to eight slices is drawn, in either theme
- **THEN** each slice takes a different colour from the categorical ramp, each clears the non-text floor against every surface, and the percentage drawn on it clears the text floor
