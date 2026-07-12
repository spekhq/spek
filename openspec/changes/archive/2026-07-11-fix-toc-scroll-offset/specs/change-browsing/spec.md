## MODIFIED Requirements

### Requirement: Change detail scrollspy
The change detail page SHALL highlight the TOC entry corresponding to the heading currently closest to the top of the viewport while the user scrolls the active markdown tab (scrollspy behavior). The threshold that decides whether a heading has been scrolled past SHALL be the same measured header bottom that hash-anchor scrolling uses, and the comparison SHALL tolerate a few pixels of rounding, so the heading a reader just scrolled to via the TOC is the one highlighted.

#### Scenario: Active entry on scroll
- **WHEN** user scrolls through a markdown tab's content while the TOC is visible
- **AND** a heading enters the top region of the viewport
- **THEN** the TOC entry matching that heading is visually highlighted as active

#### Scenario: Only one active entry
- **WHEN** multiple headings are simultaneously visible in the viewport
- **THEN** exactly one TOC entry is highlighted (the heading closest to the top)

#### Scenario: The clicked entry is the highlighted one
- **WHEN** the user clicks a TOC entry and the page finishes scrolling that heading to just below the sticky header
- **THEN** the clicked entry — not the one before it — is highlighted, whether the click started from the top of the page or mid-scroll

### Requirement: Change detail hash anchor navigation
The change detail page SHALL scroll to the heading matching the URL hash after the page loads or after the hash changes, once the active tab's markdown content finishes rendering. When a URL contains both `tab` query param and a hash, the page SHALL first activate the specified tab, then scroll to the hash-matching heading within that tab. The scroll SHALL position the target heading in the visible area **below** the sticky header (title + tab row), not at the literal viewport top where the header would obscure it. The offset SHALL be derived from the actual rendered sticky header at scroll time (falling back to the fixed app header, then a constant) rather than a fixed assumed height, so a taller-than-usual sticky header does not hide the target. The header SHALL be measured as it sits once pinned, so the offset does not drift with the reader's current scroll position.

#### Scenario: Direct link with tab and hash
- **WHEN** user opens a URL such as `/changes/<slug>?tab=design#decision-1`
- **THEN** the Design tab becomes active
- **AND** after the Design content renders, the page scrolls so the heading with slug `decision-1` sits fully visible just below the sticky header

#### Scenario: Direct link with hash but no tab param
- **WHEN** user opens `/changes/<slug>#some-heading` with no `tab` query param
- **THEN** the Proposal tab is active
- **AND** the page scrolls so the heading with slug `some-heading` in the Proposal content sits just below the sticky header

#### Scenario: Hash change while on page
- **WHEN** user clicks a TOC entry while viewing a markdown tab
- **THEN** the URL hash updates and the page scrolls so the target heading lands just below the sticky header within the current tab

#### Scenario: Tall sticky header does not obscure the target
- **WHEN** the sticky header is taller than a fixed 80px assumption (e.g. it carries worktree chips or a schema-fallback notice) and the user navigates to a heading
- **THEN** the heading lands below the measured header bottom and is not hidden behind it — the section clicked, not the next one, appears at the top of the readable area

#### Scenario: Hash with no matching heading
- **WHEN** the URL hash does not match any heading slug on the current tab
- **THEN** no scrolling occurs and the page renders at its default scroll position
