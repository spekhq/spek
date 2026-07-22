## MODIFIED Requirements

### Requirement: Graph change node ids are interpreted in one place

Graph change node ids SHALL be resolved to a change slug by **one** function, owned by `@spekjs/core` —
the package that produces the format — and consumed from there by every component and exported helper in
`@spekjs/ui` that needs a slug, today `SpecGraph` and the timeline's `changeTopicsMap`. The behaviour of
that function is specified by the `core-module` capability and is not restated here.

`@spekjs/ui` SHALL continue to export `changeNodeSlug` from its entry point, re-exporting core's
implementation, so that hosts which adopted it when it was ui's own keep working.

`@spekjs/ui` SHALL NOT carry its own copy of the parsing.

**Rationale**: ui's two consumers previously disagreed with each other, which was fixed by extracting a
shared helper into ui. That left the deeper split in place: core writes the format and ui reads it, so the
two packages can still drift — which is how the original defect arose. A host needing the same parsing
outside a bundler could not reach ui's copy either, since the package's only entry point pulls in React
and d3, and was about to reimplement it.

#### Scenario: Both consumers agree

- **WHEN** the same aggregated graph is passed to `SpecGraph` and to `changeTopicsMap`
- **THEN** both resolve a given change node to the same slug, through core's function

#### Scenario: Existing consumers keep working

- **WHEN** a host that imports `changeNodeSlug` from `@spekjs/ui` upgrades
- **THEN** the import still resolves and behaves identically

#### Scenario: No second implementation

- **WHEN** the package's sources are inspected
- **THEN** the parsing appears once, as a re-export of core's function, and is not reimplemented

### Requirement: React is a peer dependency

The package SHALL declare `react` and `react-dom` as **peer** dependencies, and SHALL NOT declare them
as direct dependencies — two React instances in one application break hooks at runtime.

`@spekjs/core` SHALL likewise be a peer dependency: the components use its types and, at runtime, its
`graph-node-id` subpath, and the host and the package must agree on one definition of them.

Because that subpath is a runtime import, the declared `@spekjs/core` range SHALL have a floor at the
core version that introduced it. A range that admits an older core resolves a package without the
subpath and fails when the module is loaded — not at install, and not during type checking, where
`skipLibCheck` suppresses the unresolved specifier inside this package's own declaration files.

#### Scenario: Peer dependencies declared

- **WHEN** inspecting the package manifest
- **THEN** `react`, `react-dom` and `@spekjs/core` appear under `peerDependencies` and not under
  `dependencies`

#### Scenario: Core peer floor covers the subpath

- **WHEN** the declared `@spekjs/core` peer range is compared against the core version that introduced
  the `graph-node-id` subpath
- **THEN** the range excludes every core version older than it

## ADDED Requirements

### Requirement: The published package is loadable by Node ESM

`@spekjs/ui` declares `"type": "module"`, so its published output SHALL satisfy Node's ESM resolver:
every relative specifier it emits SHALL carry a file extension. Importing the package SHALL work in
plain Node, not only through a bundler.

The repository SHALL carry an automated guard that fails when a source file reintroduces an
extensionless relative specifier — a build-time check from the compiler, or a test. A guard is required
rather than optional: every consumer in this repository resolves through a bundler, which tolerates the
omission, so a regression would otherwise reach the registry unnoticed.

**Rationale**: all three published versions emit `from "./SpecGraph"`, which Node rejects.
Nothing failed, because every consumer bundled — it was found only when a host tried to import the
package from a Node process.

#### Scenario: Importing from plain Node

- **WHEN** the published package is imported from a Node ESM context
- **THEN** it resolves, rather than failing with `ERR_MODULE_NOT_FOUND` on an internal specifier

#### Scenario: A new file omits an extension

- **WHEN** a source file adds a relative import with no file extension
- **THEN** the guard fails, before the package can be published
