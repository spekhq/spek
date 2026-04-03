## ADDED Requirements

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
