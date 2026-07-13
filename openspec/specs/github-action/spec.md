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

The repository SHALL maintain a `v1` tag that points to the latest stable release, following GitHub
Action versioning conventions.

#### Scenario: User references v1 tag

- **WHEN** a workflow uses `spekhq/spek@v1`
- **THEN** GitHub resolves to the latest release commit that includes a working `action.yml`

#### Scenario: Tag updated on release

- **WHEN** a new version is released via the release skill
- **THEN** the `v1` tag is force-updated to point to the new release commit
- **AND** the tag is pushed to origin

#### Scenario: Former location does not resolve

- **WHEN** a workflow uses `kewang/spek@v1`
- **THEN** the reference fails to resolve — GitHub does not redirect action references, so no
  `@v1` under the former owner is reachable
- **AND** this is the intended, accepted consequence of the move; it SHALL NOT be "fixed" by
  reoccupying the former name

### Requirement: README version references

The README documentation SHALL reference the canonical repository `spekhq/spek` and the stable `@v1`
tag in every GitHub Action usage example.

#### Scenario: English README examples

- **WHEN** a user reads the GitHub Action section in `README.md`
- **THEN** every usage example shows `uses: spekhq/spek@v1`

#### Scenario: Chinese README examples

- **WHEN** a user reads the GitHub Action section in `README.zh-TW.md`
- **THEN** every usage example shows `uses: spekhq/spek@v1`

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

- **WHEN** 使用者的 workflow 透過 `spekhq/spek@v1` 執行本 action
- **THEN** 各步驟所用的 action 版本不觸發 GitHub 對過時 Node runtime 的 deprecation 警告

#### Scenario: Action versions in action.yml

- **WHEN** 檢視 `action.yml`
- **THEN** `actions/checkout` 引用 `v7`（取代過時的 `v4`）
- **AND** `actions/setup-node` 引用 `v6`
- **AND** `actions/cache` 引用 `v6`

### Requirement: Action source repository

The composite action's self-checkout step SHALL reference the canonical repository `spekhq/spek`
explicitly, and SHALL NOT reference any former location of this repository.

This requirement exists because a stale reference here **does not fail**. The consumer-facing
`uses:` reference and this self-checkout are two distinct layers: GitHub deliberately does **not**
redirect action `uses:` references (a renamed repository yields `repository not found`), but this
step resolves through `actions/checkout`, which uses git — and git **does** follow GitHub's
repository redirect. A stale value therefore resolves silently and passes every test.

The consequence of that silent success is what the requirement guards against: the action's own
source would become permanently dependent on a redirect, and GitHub disables that redirect the
moment the former name is reoccupied. At that point the action would check out an entirely
different repository and execute it inside consumers' CI, with no one having changed anything.

Consequently, the former name `kewang/spek` SHALL NOT be reoccupied — the repository redirect is
load-bearing for already-published npm package metadata, which cannot be amended.

#### Scenario: Action checks out its own source

- **WHEN** the composite action runs
- **THEN** its checkout step specifies `repository: spekhq/spek`

#### Scenario: No reference to a former location

- **WHEN** `action.yml` is inspected
- **THEN** no step references `kewang/spek`

### Requirement: Action build chain

After installing its dependencies, the composite action SHALL explicitly build every workspace
package the static site depends on — `@spekjs/core` **and** `@spekjs/ui` — and SHALL NOT rely on an
install-time lifecycle hook to have built them.

This requirement is the missing piece that let the action break silently. `@spekjs/ui` builds at
**publish** time (`prepublishOnly`), not at install time: a `prepare` hook would run before npm has
created the workspace symlinks, so the package's build could not resolve `@spekjs/core` and it took
the whole `npm ci` down. The action's `npm ci` therefore produces no `dist` for the workspace
packages — while the static-site build resolves `@spekjs/ui/styles.css` out of exactly that `dist`.

When ui's build moved off `prepare`, the VS Code and IntelliJ pipelines were repaired because their
capabilities each carry a build-chain requirement. **This capability carried none, so there was
nothing to update and nothing to fail** — the action shipped broken. The requirement exists so that
any future change to how the packages are built has something here that must be reconciled.

#### Scenario: Workspace packages built before the site build

- **WHEN** the action runs
- **THEN** it builds `@spekjs/core` and `@spekjs/ui` after `npm ci`, before invoking the
  static-site build

#### Scenario: No reliance on install-time builds

- **WHEN** `npm ci` runs inside the action's checkout of spek
- **THEN** the action does not assume it produced any workspace package's `dist`

