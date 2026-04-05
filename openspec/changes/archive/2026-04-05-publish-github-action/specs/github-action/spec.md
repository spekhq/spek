## ADDED Requirements

### Requirement: Marketplace publishing
The GitHub Action SHALL be published to the GitHub Actions Marketplace, discoverable by searching "spek" or "OpenSpec".

#### Scenario: Marketplace listing
- **WHEN** a user searches "spek" or "OpenSpec" on the GitHub Actions Marketplace
- **THEN** the action "spek - OpenSpec Static Site" appears in search results with the correct branding (book-open icon, orange color)

### Requirement: Major version tag
The repository SHALL maintain a `v1` tag that points to the latest stable release, following GitHub Action versioning conventions.

#### Scenario: User references v1 tag
- **WHEN** a workflow uses `kewang/spek@v1`
- **THEN** GitHub resolves to the latest release commit that includes a working `action.yml`

#### Scenario: Tag updated on release
- **WHEN** a new version is released via the release skill
- **THEN** the `v1` tag is force-updated to point to the new release commit
- **AND** the tag is pushed to origin

### Requirement: README version references
The README documentation SHALL reference the stable `@v1` tag in all GitHub Action usage examples.

#### Scenario: English README examples
- **WHEN** a user reads the GitHub Action section in `README.md`
- **THEN** all `uses: kewang/spek@...` references show `@v1` instead of `@master`

#### Scenario: Chinese README examples
- **WHEN** a user reads the GitHub Action section in `README.zh-TW.md`
- **THEN** all `uses: kewang/spek@...` references show `@v1` instead of `@master`
