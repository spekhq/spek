## Purpose

提供對外發佈的 composite GitHub Action，於 CI 中將 repo 的 OpenSpec 內容建置為靜態 HTML 檢視站。

## Requirements

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

### Requirement: Badge generation input
The GitHub Action SHALL accept a `generate-badges` boolean input to enable badge generation.

#### Scenario: Badges enabled
- **WHEN** a workflow specifies `generate-badges: true`
- **THEN** the action generates SVG badge files in addition to the static HTML site

#### Scenario: Badges disabled by default
- **WHEN** a workflow uses the action without specifying `generate-badges`
- **THEN** no badge files are generated

### Requirement: Badges path output
The GitHub Action SHALL expose a `badges-path` output containing the path to the generated badge directory.

#### Scenario: Badges path available after build
- **WHEN** `generate-badges` is `true` and the build completes successfully
- **THEN** subsequent workflow steps can reference the badges directory via `steps.<id>.outputs.badges-path`

### Requirement: Maintained action runtime versions
對外 composite action（`action.yml`）的每個步驟 SHALL 引用 GitHub 目前支援、跑在維護中 Node runtime 的 action 版本，SHALL NOT 依賴 GitHub 已標記過時的版本，以免使用者收到 deprecation 警告或在該 runtime 移除後失效。

#### Scenario: No deprecated action runtime
- **WHEN** 使用者的 workflow 透過 `kewang/spek@v1` 執行本 action
- **THEN** 各步驟所用的 action 版本不觸發 GitHub 對過時 Node runtime 的 deprecation 警告

#### Scenario: Action versions in action.yml
- **WHEN** 檢視 `action.yml`
- **THEN** `actions/checkout` 引用 `v7`（取代過時的 `v4`）
- **AND** `actions/setup-node` 引用 `v6`
- **AND** `actions/cache` 引用 `v6`
