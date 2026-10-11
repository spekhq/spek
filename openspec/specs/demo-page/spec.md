## Purpose

Ship a single HTML file that shows spek working, with spek's own OpenSpec content embedded, so that
evaluating the project requires neither an install nor a repo of one's own.

## Requirements

### Requirement: Self-contained single-file demo

The project SHALL build a demo to `docs/demo.html` that is a **single self-contained file**: JavaScript,
CSS, fonts and OpenSpec data are inlined, and rendering it requires no network request and no server.

`docs/` is what GitHub Pages publishes, so the built file is committed to the repository rather than
produced at deploy time.

A web font the page loads SHALL be embedded in the page together with the notice its licence requires,
rather than requested from a font service. The build SHALL enforce this rather than rely on the
template being remembered: it SHALL fail, naming the element and not writing the output file, if the
assembled page contains an element that loads a resource from a URL with a scheme other than `data:`
or from a protocol-relative URL; and the project's tests SHALL fail if the project's own stylesheets,
or the embedded font CSS, reach such a URL through `url()` or `@import`. `data:` URLs are part of the
page and are allowed. A hyperlink loads nothing and is not judged.

What the application requests at run time on the reader's action — a remote image an artifact's
Markdown links to — is the content's own and is outside this requirement, as is CSS shipped inside the
bundle's third-party dependencies.

**Rationale**: the page template linked Google Fonts from the start, so every visitor's browser asked
Google for a font while this requirement said the page issued no request. The same template is what the
GitHub Action publishes for every consumer.

#### Scenario: Build the demo

- **WHEN** `npm run build:demo` is run
- **THEN** `docs/demo.html` is written, containing the application and spek's own OpenSpec content

#### Scenario: No external dependencies

- **WHEN** `docs/demo.html` is opened directly from disk over `file://`, or served from any host
- **THEN** it renders fully in its own font, issuing no request to any external host

#### Scenario: The font's licence travels with it

- **WHEN** the built page is inspected
- **THEN** it contains the embedded font's copyright notice and licence text

#### Scenario: A template that loads from another origin fails the build

- **WHEN** the page template contains a `<link rel="preconnect">` or a `<script src>` whose URL is
  `https:` or protocol-relative
- **THEN** the build fails with a non-zero exit naming that element
- **AND** the output file is not written

#### Scenario: A part that breaks out is named as that part

- **WHEN** the application stylesheet contains `</style>` followed by a `<link>` to an `https:` URL
- **THEN** the build fails naming the stylesheet, not the `<link>` element it produced

#### Scenario: A remote import in the project's stylesheet fails the tests

- **WHEN** `global.css` gains `@import url("https://fonts.example.com/f.css")`
- **THEN** the project's tests fail, naming the file and the URL

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

### Requirement: The demo payload does not depend on the machine that built it

The embedded data SHALL contain only content a clean checkout of the repository has. The build reads
the machine it runs on, and `docs/` is published exactly as committed, so anything machine-specific
that reaches the payload is served to every visitor.

Two sources are machine-specific and SHALL be excluded: schemas resolved from the builder's
user-level directory, and project-local schemas that git does not track — a schema hidden by
`.git/info/exclude` is on disk and invisible to everyone else. Absolute filesystem paths carried on
embedded records — schema definitions and spec records alike — SHALL be reduced to their
source-relative form, since an absolute path is a home directory or an npm install location and there
is no filesystem behind it in a published page.

This SHALL be enforced by the build rather than by instructions to whoever runs it. The guarantee is
that the payload is a function of the commit, which a step a person has to remember cannot provide.
The build SHALL fail, listing each offending field, if a path on a record the build produces — a spec
record, a schema definition or one of its shadows — is absolute. Content is not such a record: an
absolute path an author wrote into an artifact, or into a change's metadata, reaches the reader
unchanged.

**Rationale**: a first build embedded twelve of the maintainer's machine-local schemas plus one
excluded from git, advertising to every visitor a set of workflows nobody else has. Spec records
carried the builder's absolute checkout path through v1.20.0, unread by any page, because only schema
definitions were reduced.

#### Scenario: Machine-local schemas are excluded

- **WHEN** the demo is built on a machine carrying user-level schemas and an untracked project schema
- **THEN** neither appears in the embedded payload, and the build reports each one it skipped

#### Scenario: Embedded paths carry no home directory

- **WHEN** an embedded schema definition or spec record is inspected in the built file
- **THEN** its location reads in its source's own terms rather than as an absolute path on the build machine

#### Scenario: A spec record's path is relative to the repository

- **WHEN** the repository has a spec at `openspec/specs/contracts/pagination/spec.md`
- **THEN** that spec's record in the payload carries the path `openspec/specs/contracts/pagination/spec.md`

#### Scenario: An absolute record path fails the build

- **WHEN** a spec record's or schema definition's path is `/home/someone/repo/openspec/specs/a/spec.md`
  or `C:\repo\openspec\specs\a\spec.md`
- **THEN** the build fails with a non-zero exit listing that field
- **AND** the output file is not written

#### Scenario: Content quoting an absolute path is kept

- **WHEN** an artifact's text contains `/home/someone/repo`, or a change's `.openspec.yaml` has
  `path: /home/someone/repo`
- **THEN** the build succeeds and the viewer receives that text and that metadata unchanged

#### Scenario: Two machines build the same payload

- **WHEN** the demo is built from the same commit on two machines with different schemas installed
- **THEN** the embedded OpenSpec data is identical

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

### Requirement: Embedded content cannot change the structure of the page

The build SHALL write every value it embeds — the OpenSpec payload, the page title, the embedded font
CSS, and the application's script and stylesheet — so that the generated document parses into exactly the
elements the build assembled, in the order it assembled them, each holding the text it was given
(with line endings normalised as the HTML parser normalises them). What an artifact or a title says
SHALL NOT decide where an element ends.

The payload and the title come from content the build does not control: any repository's OpenSpec
text, and a title passed on the command line or as the GitHub Action's `title` input. They SHALL be
encoded so that no spelling of them is read as markup; the data the viewer receives and the text of
the page's `<title>` element SHALL be identical to the originals.

The application's script and stylesheet are the project's own build output, and the font CSS is
assembled from a pinned font package; none of them can be re-encoded without changing what it means. The build SHALL parse the assembled document before
writing it. If the parsed document does not contain exactly the assembled elements with their text,
the build SHALL fail with a non-zero exit, name the first part in document order whose element
diverges — the title, the payload, the font CSS, the script or the stylesheet — and not write the output file. A
document whose embedded parts do not parse back as written SHALL NOT be produced by a build that
reports success.

The check SHALL follow how an HTML parser reads the document rather than reject a list of character
sequences. Sequences such as `<!--` and `<script` are inert in most positions, and a check that
rejected them outright would reject valid application bundles.

**Rationale**: an artifact documenting how to embed JSON-LD contained `</script>`; the build reported
success and the page rendered its payload as plain text (#54). The build is what the GitHub Action
runs, so every consumer whose content mentions that sequence published a broken snapshot with
nothing in CI to say so.

#### Scenario: Artifact text contains a closing script tag

- **WHEN** a spec or change artifact contains `</script>`, in any letter case
- **THEN** the generated page boots
- **AND** the viewer receives that artifact's text unchanged

#### Scenario: Artifact text opens a comment and then a script tag

- **WHEN** an artifact contains `<!--` followed later by `<script>`, with no `-->` between them
- **THEN** the generated page boots
- **AND** the viewer receives that artifact's text unchanged

#### Scenario: Title contains markup

- **WHEN** the build is given a title containing `</title>`, `<b>` or `&amp;`
- **THEN** the text of the page's `<title>` element is exactly the title given
- **AND** the document contains no element the build did not assemble

#### Scenario: Application bundle would not parse back as written

- **WHEN** the application's script contains an unescaped `</script>`, or `<!--` followed by
  `<script>` with no `-->` between them, or the stylesheet contains `</style>`
- **THEN** the build fails with a non-zero exit, naming the script or the stylesheet
- **AND** the output file is not written

#### Scenario: The failure names the part that caused it

- **WHEN** the stylesheet contains `</style>` followed by a `<script>` element
- **THEN** the build names the stylesheet, not the script element that sequence produced

#### Scenario: Application bundle contains inert sequences

- **WHEN** the application's script contains `<script>` before any `<!--`, or `<!--`, then `-->`,
  then `<script>`
- **THEN** the build succeeds

#### Scenario: Font CSS would not parse back as written

- **WHEN** the font CSS contains `</style>`
- **THEN** the build fails with a non-zero exit, naming the font CSS
- **AND** the output file is not written
