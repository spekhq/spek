## MODIFIED Requirements

### Requirement: Spec detail hash anchor navigation
The spec detail page SHALL scroll to the heading matching the URL hash when the page mounts or when the hash changes, after the markdown content finishes rendering. The scroll SHALL position the target heading in the visible area **below** any sticky or fixed header rather than at the literal viewport top, with the offset measured from the actual rendered header at scroll time (falling back to the fixed app header, then a constant) rather than a fixed assumed height.

#### Scenario: Direct link with hash
- **WHEN** user opens a URL such as `/specs/foo#requirement-bar` directly
- **THEN** after the page loads and content renders, the page scrolls so the heading whose slug is `requirement-bar` sits fully visible just below the fixed header

#### Scenario: Hash change while on page
- **WHEN** the URL hash changes (e.g., user clicks a TOC entry or another in-page hash link) while already on the spec detail page
- **THEN** the page scrolls so the target heading lands just below the header, not behind it

#### Scenario: Hash with no matching heading
- **WHEN** the URL hash does not match any heading slug on the current spec
- **THEN** no scrolling occurs and the page renders at its default scroll position
