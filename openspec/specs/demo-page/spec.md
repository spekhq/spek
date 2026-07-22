## Purpose

Ship a single HTML file that shows spek working, with spek's own OpenSpec content embedded, so that
evaluating the project requires neither an install nor a repo of one's own.

## Requirements

### Requirement: Self-contained single-file demo

The project SHALL build a demo to `docs/demo.html` that is a **single self-contained file**: JavaScript,
CSS and OpenSpec data are inlined, and rendering it requires no network request and no server.

`docs/` is what GitHub Pages publishes, so the built file is committed to the repository rather than
produced at deploy time.

#### Scenario: Build the demo

- **WHEN** `npm run build:demo` is run
- **THEN** `docs/demo.html` is written, containing the application and spek's own OpenSpec content

#### Scenario: No external dependencies

- **WHEN** `docs/demo.html` is opened directly from disk over `file://`, or served from GitHub Pages
- **THEN** it renders fully, issuing no request to any external host

### Requirement: The published demo is a production build

The demo that ships SHALL be a production build of the application.

The build follows the ambient `NODE_ENV`, so a build run without it set to `production` produces a
development React bundle — larger, slower, and emitting development-only warnings — that is
indistinguishable from a correct build by file name alone. Release automation SHALL set `NODE_ENV`
explicitly rather than relying on the shell's default.

**Rationale**: v1.8.0 shipped a development bundle to the live demo for exactly this reason.

#### Scenario: Release build sets the environment

- **WHEN** the demo is rebuilt as part of a release
- **THEN** `NODE_ENV=production` is set for the build

#### Scenario: Verifying a build before publishing

- **WHEN** the built `docs/demo.html` is inspected
- **THEN** it contains no development-only React build markers

### Requirement: Demo entry point uses hash routing

The demo SHALL use its own entry point (`DemoApp`) with a **hash** router, not the web application's
history router, so that every route works from `file://` and from a Pages subpath.

It SHALL reuse the web application's pages unchanged — Dashboard, Specs, Spec detail, Changes, Change
detail, Graph, Timeline — and SHALL NOT offer repo selection, since the data is fixed at build time.

#### Scenario: Navigating the demo

- **WHEN** the user moves between views
- **THEN** the URL's hash changes (e.g. `#/specs/api-adapter`) and the view renders

#### Scenario: Opening a deep link

- **WHEN** a URL carrying a hash route is opened directly
- **THEN** that view renders, with no server-side route handling involved

#### Scenario: No repo selection

- **WHEN** the demo loads
- **THEN** it opens on the dashboard for its embedded content, without asking for a repository path

### Requirement: Demo data is read through the adapter interface

The demo SHALL obtain its data through an `ApiAdapter` implementation over the embedded payload, so the
pages it reuses stay unaware of where their data comes from.

The behaviour of that adapter is specified by the `api-adapter` capability and is not restated here.

#### Scenario: Pages are host-agnostic

- **WHEN** a page renders in the demo
- **THEN** it obtains data through the adapter from context, exactly as it does in the web application
