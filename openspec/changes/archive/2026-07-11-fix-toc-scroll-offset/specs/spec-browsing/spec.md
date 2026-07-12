## MODIFIED Requirements

### Requirement: Spec detail scrollspy
The spec detail page SHALL highlight the TOC entry corresponding to the heading currently closest to the top of the viewport while the user scrolls (scrollspy behavior). The threshold that decides whether a heading has been scrolled past SHALL be the same measured header bottom that hash-anchor scrolling uses, and the comparison SHALL tolerate a few pixels of rounding, so the heading a reader just scrolled to via the TOC is the one highlighted.

#### Scenario: Active entry on scroll
- **WHEN** the user scrolls the spec detail content and a heading enters the top region of the viewport
- **THEN** the TOC entry matching that heading is visually highlighted as active

#### Scenario: Only one active entry
- **WHEN** multiple headings are simultaneously visible in the viewport
- **THEN** exactly one TOC entry is highlighted as active (the heading closest to the top)

#### Scenario: The clicked entry is the highlighted one
- **WHEN** the user clicks a TOC entry and the page finishes scrolling that heading to just below the header
- **THEN** the clicked entry — not the one before it — is highlighted

### Requirement: Spec detail hash anchor navigation
The spec detail page SHALL scroll to the heading matching the URL hash when the page mounts or when the hash changes, after the markdown content finishes rendering. The scroll SHALL position the target heading in the visible area **below** any sticky or fixed header rather than at the literal viewport top, with the offset measured from the actual rendered header at scroll time (falling back to the fixed app header, then a constant) rather than a fixed assumed height. The header SHALL be measured as it sits once pinned, so the offset does not drift with the reader's current scroll position.

#### Scenario: Direct link with hash
- **WHEN** user opens a URL such as `/specs/foo#requirement-bar` directly
- **THEN** after the page loads and content renders, the page scrolls so the heading whose slug is `requirement-bar` sits fully visible just below the fixed header

#### Scenario: Hash change while on page
- **WHEN** the URL hash changes (e.g., user clicks a TOC entry or another in-page hash link) while already on the spec detail page
- **THEN** the page scrolls so the target heading lands just below the header, not behind it

#### Scenario: Hash with no matching heading
- **WHEN** the URL hash does not match any heading slug on the current spec
- **THEN** no scrolling occurs and the page renders at its default scroll position
