## MODIFIED Requirements

### Requirement: Custom typography
The system SHALL use "Plus Jakarta Sans" as the primary font family for all UI text. The web app loads it via Google Fonts CDN; the static single-file page — the demo and the GitHub Action's output — embeds it (see `demo-page`) and requests nothing. The VS Code and IntelliJ webviews load no web font and render the fallback. The font stack SHALL include `sans-serif` as fallback for offline environments. Code and monospace text SHALL continue to use "JetBrains Mono".

#### Scenario: Font loading
- **WHEN** the application loads in a browser with internet access
- **THEN** "Plus Jakarta Sans" is loaded and applied to all non-code text elements

#### Scenario: Font fallback
- **WHEN** the web app loads without internet access (or Google Fonts is blocked)
- **THEN** the browser falls back to the system default sans-serif font

#### Scenario: Static page offline
- **WHEN** the static single-file page is opened without internet access
- **THEN** "Plus Jakarta Sans" is applied to all non-code text elements

#### Scenario: Reduced motion preference
- **WHEN** the user has `prefers-reduced-motion: reduce` set in their OS/browser
- **THEN** all CSS entry animations are disabled
