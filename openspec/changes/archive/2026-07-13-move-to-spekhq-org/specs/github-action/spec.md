## ADDED Requirements

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

## MODIFIED Requirements

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
