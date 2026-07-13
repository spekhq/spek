# ui-package Specification

## Purpose
TBD - created by archiving change extract-ui-package. Update Purpose after archive.
## Requirements
### Requirement: `@spekjs/ui` package exports reusable visualization components

The repository SHALL provide a `@spekjs/ui` package that exports the two OpenSpec visualizations as
reusable React components:

- **`SpecGraph`** — the force-directed graph of spec ↔ change relationships.
- **`ChangeTimeline`** — the Gantt-style timeline of change lifecycles.

These two SHALL remain **distinct visualizations**: the graph shows relationships (no notion of time),
the timeline shows lifecycles on a date axis. One SHALL NOT be substituted for the other.

The package SHALL NOT export the full-page views (Dashboard, SpecList, SpecDetail, ChangeList,
ChangeDetail). Those carry the web application's layout and are not reusable by a host with a
different chrome.

#### Scenario: Host renders the graph

- **WHEN** a host renders `<SpecGraph>` with graph data
- **THEN** the force-directed graph is rendered, with specs and changes as distinct node shapes and
  edges between a change and the specs it touches

#### Scenario: Host renders the timeline

- **WHEN** a host renders `<ChangeTimeline>` with a list of changes
- **THEN** each change is rendered as a horizontal bar on a date axis, spanning its lifecycle

### Requirement: Components are presentational and depend on no host facility

The exported components SHALL be **presentational**: they receive their data through props and report
user intent through callbacks. They SHALL NOT depend on any facility of a particular host.

Specifically, the components SHALL NOT:

- import or use a **router** (`react-router` or otherwise) — navigation SHALL be expressed as
  callbacks (`onSelectChange(slug)` / `onSelectSpec(topic)`), and the components SHALL NOT know the
  shape of any URL;
- import or use an **API adapter, data-fetching hook, or HTTP client** — data SHALL arrive as props;
- import or use a **theme context** — see the colour contract below.

A host SHALL be able to render the components without providing a router, an adapter, or a theme
provider.

**Rationale**: the downstream host is an Electron application with no router, whose data arrives over
IPC, and whose adapter interface is not even signature-compatible with the web's (`folderId` is the
first parameter of every method — it has several repositories open at once).

#### Scenario: Component renders without a router

- **WHEN** a host renders either component outside of any router context
- **THEN** it renders successfully

#### Scenario: Selecting a node reports intent to the host

- **WHEN** the user activates a change in either component
- **THEN** the component invokes the host-supplied callback with that change's slug, and performs no
  navigation itself

#### Scenario: Package declares no router or adapter dependency

- **WHEN** inspecting the package's dependencies
- **THEN** no router package is listed, in any dependency class

### Requirement: The package defines an explicit colour contract

The package SHALL express all of its colours through a documented set of CSS custom properties under
a package-owned prefix, and SHALL ship default values for them. A host SHALL be able to re-theme both
components **solely by overriding those custom properties**.

The components SHALL NOT read CSS custom properties belonging to the host's own design system, and
SHALL NOT require the host to use any particular CSS framework.

**Rationale**: the components previously read the web application's Tailwind theme tokens directly
(`--color-border`, `--color-text-primary`, …) and styled themselves with its semantic utility classes.
A host whose tokens are named differently — as the downstream Electron application's are — would
render the graph with no colours at all.

#### Scenario: Host overrides the colour contract

- **WHEN** a host defines the package's colour custom properties with its own values
- **THEN** both components render in the host's colours

#### Scenario: Host provides no colours

- **WHEN** a host renders the components without defining any of the package's custom properties
- **THEN** the components render with the package's default colours, not with missing or transparent
  colours

#### Scenario: Package does not require the host's CSS framework

- **WHEN** a host that does not use the same CSS framework renders the components
- **THEN** the components are styled correctly

### Requirement: Theme changes are signalled by the host, not detected by the package

The graph resolves its colours imperatively (they are written into SVG attributes). It SHALL re-render
when the host signals that the theme has changed, via an explicit prop.

The package SHALL NOT attempt to detect theme changes by observing the host's DOM — a host is not
required to signal a theme change in any particular way.

#### Scenario: Host signals a theme change

- **WHEN** the host changes the value of the theme-signal prop
- **THEN** the graph re-resolves its colours and re-renders

### Requirement: React is a peer dependency

The package SHALL declare `react` and `react-dom` as **peer** dependencies, and SHALL NOT declare them
as direct dependencies — two React instances in one application break hooks at runtime.

`@spekjs/core` SHALL likewise be a peer dependency: the components use only its types, and the host
and the package must agree on one definition of them.

#### Scenario: Peer dependencies declared

- **WHEN** inspecting the package manifest
- **THEN** `react`, `react-dom` and `@spekjs/core` appear under `peerDependencies` and not under
  `dependencies`

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

### Requirement: `@spekjs/web` consumes the package with no change in behaviour

`@spekjs/web` SHALL render its graph and timeline pages using the components from `@spekjs/ui`.
Those pages SHALL retain their current behaviour and appearance — the extraction is not an occasion to
change what the user sees.

The pages SHALL retain everything that is the host's own concern: data fetching, loading and error
states, routing, the theme toggle, and the page chrome.

All of the web application's build targets SHALL continue to build, and the timeline's existing unit
tests SHALL continue to pass after moving with the code they test.

#### Scenario: Graph page behaves as before

- **WHEN** the user opens the graph page
- **THEN** it behaves as it did before the extraction, including zoom, pan, node dragging, neighbour
  highlighting, and navigating to a change by activating its node

#### Scenario: Timeline page behaves as before

- **WHEN** the user opens the timeline page
- **THEN** it behaves as it did before the extraction, including grouping by topic, hiding active or
  archived changes, the tooltip, and navigating to a change

#### Scenario: All build targets still build

- **WHEN** each of the web application's build targets is built
- **THEN** every one of them succeeds

#### Scenario: Timeline unit tests travel with the code

- **WHEN** the timeline's lane-building and scale logic move into the package
- **THEN** their existing unit tests move with them and pass there

