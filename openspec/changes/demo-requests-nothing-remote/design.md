# Design

## Context

`scripts/build-demo.ts` scans a repository, builds the payload, runs the demo's Vite build, and hands the
pieces to `assembleDemoHtml` in `scripts/demo-html.ts`, which writes the page from a template and checks
that it parses back into exactly the `<title>`, `<style>` and `<script>` elements it wrote (#54).
`demo-html.ts` is kept free of `packages/core/dist` imports and import-time side effects so `npm test`
runs it without a core build; `build-demo.ts` runs the whole build when imported, so nothing in it can be
unit-tested. The GitHub Action runs the same script.

The Vite demo build emits no separate stylesheet today: the page's `<style>` part is absent, and the
Tailwind output travels inside the script bundle and is injected at run time. The font is requested by
three `<link>` elements hard-coded into the template; `global.css` names `"Plus Jakarta Sans"`. The code
font (`"JetBrains Mono", "Fira Code", monospace`) is never fetched by anything — it uses whatever the
reader has installed — and this change does not alter that.

## Goals / Non-Goals

**Goals:** the demo, and the action's page, open without a request to any host; no record the build
produces carries an absolute path; both enforced by the build and its tests.

**Non-Goals:** the web app's font loading; remote images an artifact's Markdown links to (they load when
the reader opens that artifact — content the author put there, and already stated on the website's
*Data and network* page); CSS shipped inside third-party dependencies of the bundle (none reaches a
remote URL today, and none is the project's to edit); serving the demo from spekterm.com (the website's
repository does that).

## Decisions

### D1. Embed the font as `data:` URLs in a `<style>` the template writes

`css2?family=Plus+Jakarta+Sans:wght@400..800&display=swap` resolves to four `@font-face` rules —
cyrillic-ext, vietnamese, latin-ext, latin; `font-style: normal`, `font-weight: 400 800` — whose woff2
files are byte for byte the four `plus-jakarta-sans-*-wght-normal.woff2` files of
`@fontsource-variable/plus-jakarta-sans@5.3.0` (compared with `cmp`). They total 59,144 bytes, 78,860 as
base64. Each becomes one `@font-face` with `font-family: "Plus Jakarta Sans"` — the name `global.css`
already uses, so no application code changes — `font-style: normal`, **`font-weight: 400 800`** (what
Google declared for the same files, so `lighter` and every other weight resolve exactly as before),
`font-display: swap`, and its `unicode-range` read from the package's `wght.css`.

Italic: the link requests no italic axis, so the browser synthesises the italic of Markdown emphasis
today; embedding only the normal style keeps exactly that.

The rule-building is a **pure function** in a new module, `scripts/demo-fonts.ts`
(`buildFontFaceCss({ wghtCss, license, files })` → CSS string), with the same no-side-effect discipline
as `demo-html.ts` so it is unit-tested. It throws when it finds no `*-wght-normal.woff2` rule in
`wghtCss`, or when the rules it built do not match the normal files it was given one for one — a
change to the package's CSS format must stop the build, not silently produce a page with no font.
`build-demo.ts` does only the I/O: resolve the package, read `wght.css`, `LICENSE` and the woff2 files,
call the function, and pass the result to `assembleDemoHtml` as a new optional `fonts` part. The
template writes it as its own `<style>` in `<head>`, before the application stylesheet, and the
structural check tracks it as `part: "fonts"`.

**Alternatives considered.**
- *Import the font CSS in `main.demo.tsx` and let Vite inline the files* (`assetsInlineLimit`). The
  package's family is `"Plus Jakarta Sans Variable"`, so it needs a wrapper stylesheet anyway, and the
  inlining limit is global to the demo build — it would also inline whatever asset someone adds next.
- *Drop the brand font and fall back to the system sans-serif.* Zero bytes and no licence notice, but the
  demo is what people judge spek by, and it would no longer look like the app they would install.
- *Commit the woff2 files into the repository.* Same bytes, a second copy to keep current by hand; the
  devDependency is pinned by the lockfile and read only at build time.

### D2. The licence travels with the font

OFL-1.1 lets the font be bundled with software provided each copy carries the copyright notice and the
licence. The fonts CSS opens with a comment holding the package's `LICENSE` text (copyright line plus
the OFL, 4,534 bytes). `buildFontFaceCss` throws if the text contains `*/` — the comment would end early
and the rest would become stray CSS that can swallow the first rule, a failure the structural check
cannot see because the element's text would still be exactly what was written. The `</style` case is
the structural check's, as for every part.

### D3. A spec record's `path` is relative to the repository

`build-demo.ts` maps `scan.specs` to copies whose `path` is `path.relative(REPO_DIR, spec.path)` with
`/` separators — `openspec/specs/contracts/pagination/spec.md` — before they go into the payload. The
scanner's own result is unchanged: the web app, VS Code and IntelliJ run on the reader's machine, where
the absolute path is the reader's own. No page reads `SpecInfo.path` (the tree's `node.path` is built
from `topic`; `StaticAdapter` passes the list through).

### D4. Enforcement

**Order.** `assembleDemoHtml` runs the structural check first and the origin check second. A part that
breaks out of its element (a stylesheet holding `</style><link href="https://x">`) must be reported as
that part, as the existing scenario *The failure names the part that caused it* requires — not as the
`<link>` it produced.

**Elements.** The origin check is an exported pure function, `verifyDemoOrigins(html)`, so it is tested
on hand-written pages — through `assembleDemoHtml` only a part breaking out can produce an element, and
that fails the structural check first. It walks the parsed document and rejects any element that loads a resource
from a URL with a scheme other than `data:`, or a protocol-relative one. "Loads" is the attribute set
spekterm's `check-origins` uses — `script[src]`, `link[href]` (every `rel`, `preconnect` included),
`img`/`source[src, srcset]`, `iframe`/`embed`/`track`/`audio`/`input[src]`, `video[src, poster]`,
`object[data]` — so the page passes the element half of the website's own check by construction (its `<style>` half is
covered by the stylesheet test below; the template writes no `style=` attribute), and `<a href>`, which loads
nothing, is not judged. It throws a new `DemoHtmlLoadError` naming the element and the URL; it is not a
`DemoHtmlError`, whose message is about a part not parsing back as written. Since any part that spilled
into markup already failed the structural check, an element reaching this check came from the template —
which is how the Google links got there.

**Stylesheets.** CSS is invisible to the element walk: the application's CSS is injected by the script
at run time, and an `@import url("https://fonts…")` added to `global.css` — the most likely way this
regresses — would pass it. A test in `scripts/` reads the project's own stylesheets
(every `*.css` under `packages/web/src/` and `packages/ui/src/`, by glob) and the CSS `buildFontFaceCss`
produces, and fails on any `url()` or `@import` whose target has a scheme other than `data:` or is
protocol-relative.

**Payload paths.** A pure `findAbsolutePaths(payload)` in `demo-html.ts` walks **only the records the
build produces** — `specs[].path`, `schemaDetails.*.path` and `schemaDetails.*.shadows[].path` — and
returns the location of every value that is absolute in POSIX or Windows form (`/…`, `C:\…`, `\\server\…`).
`build-demo.ts` fails before the Vite build, listing them. It does not walk content: artifact text and
`ChangeDetail.metadata` (every top-level key of a change's `.openspec.yaml`, kept verbatim) are the
author's, and an author's `path: /something` must reach the reader as written, not stop their build.

**Alternative considered:** fail when the payload contains the build's `REPO_DIR` anywhere. It would have
failed this repository's own build on its archived prose, and any consumer whose notes quote their
checkout — content the action must publish as written.

### D5. The archived prose is reworded, not filtered

Four archived artifacts quote the maintainer's home directory in prose, once each (seven times in the payload, where a tasks.md is embedded both raw and parsed). They are
reworded to name the repository without it; the build does not filter content, because a build that
rewrote artifact text would show the reader something other than the file. The placeholder paths in
`filesystem-api` (`/home/user/…`) and elsewhere name nobody's machine and stay.

## Risks / Trade-offs

- **About 85 KB more per page** on a 5 MB demo and on every action consumer's page. Before, a browser
  fetched only the subsets a page's text needed — usually just latin, 27 KB — but after a render-blocking
  request to a third party; now every subset is embedded and nothing is requested.
- **Consumers get it on merge**, since the action builds from `master` unless pinned. It removes requests
  and adds bytes, and adds one deliberate failure (the Impact section's absolute schema path).
- **The checks see elements and the project's stylesheets, not run-time behaviour.** A request the
  application makes while running (an artifact's remote image) is outside them, as stated in Non-Goals.
- **Line endings.** A working tree checked out with CRLF builds a payload different from CI's — a
  pre-existing gap in *Two machines build the same payload*, outside this change.
