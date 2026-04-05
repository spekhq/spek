### Requirement: Composite Action definition
The repository SHALL provide an `action.yml` at the root that defines a composite GitHub Action for building OpenSpec static sites.

#### Scenario: Action with default inputs
- **WHEN** a workflow uses the action without specifying any inputs
- **THEN** the action builds a static HTML from the repo root's `openspec/` directory and outputs to `spek-output/spek.html`

#### Scenario: Action with custom repo path
- **WHEN** a workflow specifies `repo-path: ./my-project`
- **THEN** the action scans `./my-project/openspec/` as the data source

#### Scenario: Action with custom output path
- **WHEN** a workflow specifies `output-path: public/specs.html`
- **THEN** the generated HTML is written to `public/specs.html`

#### Scenario: Action with custom title
- **WHEN** a workflow specifies `title: "My Project - OpenSpec"`
- **THEN** the generated HTML `<title>` contains "My Project - OpenSpec"

#### Scenario: Action with version pinning
- **WHEN** a workflow specifies `spek-version: v0.7.7`
- **THEN** the action checks out spek at tag `v0.7.7` for the build

### Requirement: Action outputs
The action SHALL expose an `html-path` output containing the absolute path to the generated HTML file.

#### Scenario: Output available after build
- **WHEN** the build step completes successfully
- **THEN** subsequent workflow steps can reference the output via `steps.<id>.outputs.html-path`

### Requirement: Parameterized build script
The `scripts/build-demo.ts` SHALL accept CLI arguments to specify the OpenSpec data source, output path, and page title.

#### Scenario: Build with external repo dir
- **WHEN** `build-demo.ts` is invoked with `--repo-dir /path/to/other/repo`
- **THEN** it scans `/path/to/other/repo/openspec/` instead of the spek repo

#### Scenario: Build with custom output
- **WHEN** `build-demo.ts` is invoked with `--output /tmp/my-specs.html`
- **THEN** the generated HTML is written to `/tmp/my-specs.html`

#### Scenario: Build with custom title
- **WHEN** `build-demo.ts` is invoked with `--title "Custom Title"`
- **THEN** the HTML `<title>` element contains "Custom Title"

#### Scenario: Build with no arguments (backward compatible)
- **WHEN** `build-demo.ts` is invoked without any arguments
- **THEN** it behaves identically to the current implementation (scans spek repo, outputs to `docs/demo.html`)

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
