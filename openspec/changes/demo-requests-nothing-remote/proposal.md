# Proposal

## Why

The demo is meant to move to spek's website, `spekterm.com/spek/demo/`, beside the user guide, instead of
living only at `spekhq.github.io/spek/demo.html`. The website's build refuses any page that loads
something from another origin, and the website does not publish the maintainer's home path. The demo, as
built today, fails both — and both are already requirements of `demo-page`, so this is the
implementation catching up with its own spec rather than the website imposing a new rule:

- **It loads its font from Google Fonts.** `scripts/demo-html.ts` writes two `preconnect` links and a
  stylesheet link to `fonts.googleapis.com` into every page it assembles. `demo-page` says the demo
  renders "issuing no request to any external host". Every visitor's browser has been asking Google for
  a font since the demo was first written, and the same page template is what the GitHub Action
  publishes for every consumer.
- **It embeds the builder's absolute paths.** Each entry of the payload's spec list carries `path` as
  the scanner returns it — `/home/<builder>/…/openspec/specs/<topic>/spec.md`, 56 times in v1.20.0's
  demo. `demo-page` already requires absolute paths on embedded records to be reduced to their
  source-relative form; the build does it for schema definitions (`deLocalise`) and nothing else. CLAUDE.md
  records this as "still unfiltered … separate cleanup". No page reads the field.
- **Four archived artifacts quote the maintainer's home directory in their prose** (a test repository's
  path, a `curl` against `dir=/home/…`). This is repository content, not a build defect — the payload is
  a function of the commit, as `demo-page` requires — but it is the same string, published on the same
  page.

## What Changes

- **The demo carries its own font.** The page's `@font-face` rules embed Plus Jakarta Sans as `data:`
  URLs — byte for byte the four files the Google Fonts link resolved to, declared with the same weight
  range and subsets — together with the font's SIL Open Font License notice. The three links to Google are removed. The page then makes no
  request when it opens, from `file://` or from any host.
- **Embedded spec records carry a repository-relative path** (`openspec/specs/<topic>/spec.md`), the
  form a clean checkout has.
- **The build checks both, rather than relying on the template staying right.** Assembly fails if the
  page holds an element that loads from another origin, a test fails if the project's own stylesheets
  or the font CSS reach a remote `url()` or `@import`, and the payload build fails if a path on a record
  it builds (spec records, schema definitions) is absolute. Like the existing structural check, these run
  before the file is written.
- **The four archived artifacts are reworded** to name the repositories without the home directory.

The web app (`packages/web/index.html`) keeps loading the font from Google Fonts; it runs on the reader's
own machine and is out of this change's scope.

## Capabilities

### Modified Capabilities

- `demo-page`: the self-contained requirement names web fonts explicitly and is enforced by the build;
  the machine-independence requirement covers spec records and is enforced by the build; the
  structural requirement lists the embedded font CSS as a fifth embedded value.
- `shared-layout`: "Custom typography" says the font is loaded from Google Fonts with a system fallback
  offline. That stays true of the web app and stops being true of the static page, which carries the
  font itself.

## Impact

- **GitHub Action consumers** get the change **on merge**, not at release: the action builds with
  `spek-version: master` by default, and builds the page with the same `scripts/demo-html.ts`. Their
  published page stops requesting Google Fonts and grows by the embedded font (about 85 KB). It also
  gains a way to fail: a build whose schema definition still carries an absolute path after shortening
  (a schema outside the repository, the home directory and `node_modules`, e.g. a symlinked checkout
  passed as `--repo-dir`) now stops instead of publishing that path. That is deliberate — it is the
  machine leak the requirement forbids — and the failure names the field.
- **`docs/demo.html`** is rebuilt only at release time, as always; the GitHub Pages copy changes then.
- **spekterm.com** (spekterm repository, after the release that carries this): the spek
  *Data and network* page says the static page — the action's output and the live demo — loads its font
  from Google Fonts; that row changes to *No*. The demo can then be served from the website, pinned to
  that release. That work is the website's, not this change's.
- New devDependency at the repository root: `@fontsource-variable/plus-jakarta-sans` (OFL-1.1), read at
  build time only; nothing is added to any published package.
- No change to `@spekjs/core` or `@spekjs/ui`, the web app, VS Code or IntelliJ.
