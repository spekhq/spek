## MODIFIED Requirements

### Requirement: The package is published to the npm public registry

`@spekjs/ui` SHALL be published to the npm public registry so that repositories outside this monorepo
can depend on it.

Within this monorepo, `@spekjs/web` SHALL resolve it through npm workspaces rather than from the
registry, so that development is not gated on the package's release cadence.

The package's `dist` SHALL be built when the package is published, and SHALL NOT be built as part of
installing the monorepo's dependencies. A build triggered by install (npm's `prepare` lifecycle) runs
before npm has created the workspace symlinks, so the package's TypeScript build cannot resolve
`@spekjs/core` and fails — taking the whole `npm ci` down with it. Builds that need `dist` (the web
app, the webview bundles, CI) SHALL invoke the package's build explicitly.

#### Scenario: Downstream repository installs the package

- **WHEN** a repository outside this monorepo installs `@spekjs/ui` from the registry
- **THEN** the package resolves and its components can be imported

#### Scenario: In-repo consumer resolves locally

- **WHEN** `@spekjs/web` is built within this monorepo
- **THEN** it uses the local `packages/ui` sources, not a registry copy

#### Scenario: Installing from a clean checkout

- **WHEN** `npm ci` runs in a checkout with no existing `node_modules` (a CI runner)
- **THEN** the install completes without attempting to build `@spekjs/ui`

#### Scenario: Publishing the package

- **WHEN** the package is published to the registry
- **THEN** `dist` is built as part of publishing, so the published tarball carries the compiled output
