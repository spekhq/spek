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

#### Scenario: A handed-over palette is measured

- **WHEN** the application hands a set of colours to a renderer that generates its own markup
- **THEN** each colour in that set is measured against the floor its use answers to, in every theme, or declared as owing nothing with its reason

#### Scenario: A literal in a handed-over palette fails the check

- **WHEN** a colour in such a palette is written as a literal rather than sourced from a theme token
- **THEN** the check fails, as it does for an untokenized literal anywhere else

#### Scenario: Relying on the renderer's defaults is not an answer

- **WHEN** a colour the renderer would supply from its own defaults is neither declared by the application nor stated as owing nothing
- **THEN** the check fails rather than passing on the absence of a finding
