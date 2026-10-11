# Tasks

## 1. No element loads from another origin

- [x] 1.1 Add failing tests to `scripts/demo-html.test.ts`: the exported `verifyDemoOrigins(html)` (design D4), given hand-written pages built like the existing tests' `page()` helper, rejects a document holding `<link rel="preconnect" href="https://…">`, `<link href="//host/…">`, `<script src="https://…">`, `<img srcset="… https://…">` and `<video poster="https://…">` with a `DemoHtmlLoadError` naming the element and URL; it accepts `data:` URLs and an `<a href="https://…">`; and, through `assembleDemoHtml`, a stylesheet holding `</style><link href="https://x">` fails as a `DemoHtmlError` naming the stylesheet (structural check first, design D4). Verify `npm test` fails on exactly the new cases.
- [x] 1.2 In `scripts/demo-html.ts`, add `DemoHtmlLoadError` and the exported `verifyDemoOrigins(html)` over the loading attribute set of design D4, called by `assembleDemoHtml` after the structural check; remove the two `preconnect` links and the Google Fonts stylesheet link from the template. Verify 1.1's tests and the existing structural tests pass.

## 2. The embedded font

- [x] 2.1 Add `@fontsource-variable/plus-jakarta-sans` at an exact version to the root `devDependencies`. Verify `npm ci` installs it and no published package's `package.json` changes.
- [x] 2.2 Write `scripts/demo-fonts.ts` with a pure `buildFontFaceCss({ wghtCss, license, files })` (design D1, D2) and tests in `scripts/demo-fonts.test.ts`: one `@font-face` per `*-wght-normal.woff2` with `font-family: "Plus Jakarta Sans"`, `font-style: normal`, `font-weight: 400 800`, `font-display: swap`, a base64 `data:` URL and the `unicode-range` from `wghtCss`; the licence as a leading comment; throws on no normal rule, on a rule/file mismatch, and on a licence containing `*/`. Verify `npm test` passes.
- [x] 2.3 Add an optional `fonts` part to `DemoHtmlParts`, written as its own `<style>` in `<head>` before the application stylesheet and tracked as `part: "fonts"`, with a `DemoHtmlError` cause for it that points at the font package rather than "its own bundle"; update the module's header comment (five embedded values). Add tests that a fonts part round-trips and that `</style>` inside it fails naming the font CSS. Verify `npm test` passes.
- [x] 2.4 In `scripts/build-demo.ts`, resolve the package, read `wght.css`, `LICENSE` and the four normal woff2 files, call `buildFontFaceCss`, and pass the result as `fonts`. Verify a build writes a page with four `@font-face` rules and the OFL text.

## 3. No stylesheet reaches a remote URL

- [x] 3.1 Add a test in `scripts/` that reads every `packages/web/src/**/*.css` and `packages/ui/src/**/*.css` (by glob, so a stylesheet added later is covered) and the CSS `buildFontFaceCss` produces from the installed package, and fails, naming file and URL, on a `url()` or `@import` whose target has a scheme other than `data:` or is protocol-relative; include a fixture case proving it catches `@import url("https://…")`. Verify `npm test` passes.

## 4. Relative spec paths and the payload guard

- [x] 4.1 Add a pure `findAbsolutePaths(payload)` to `scripts/demo-html.ts` that walks only `specs[].path`, `schemaDetails.*.path` and `schemaDetails.*.shadows[].path` (design D4), with tests: POSIX, Windows drive and UNC values are reported with their location; relative values are not; an absolute path in an artifact's `content` or in `changeDetails.*.metadata.path` is not. Verify `npm test` passes.
- [x] 4.2 In `scripts/build-demo.ts`, embed `specs` with each `path` made relative to `REPO_DIR` with `/` separators (design D3), and fail before the Vite build, listing every location, when `findAbsolutePaths` returns any. Verify a build of this repository passes the guard.

## 5. Archived prose

- [x] 5.1 Reword the four home-directory occurrences (one per file; seven in the payload, where a tasks.md is embedded both raw and parsed) in `openspec/changes/archive/2026-02-13-initial-implementation/proposal.md`, `2026-02-21-fix-detect-fallback/tasks.md`, `2026-04-25-add-change-lifecycle-foundation-and-p0/tasks.md` and `2026-07-13-move-to-spekhq-org/tasks.md` so none names the maintainer's home directory (design D5), leaving placeholder paths such as `filesystem-api`'s `/home/user/…` alone. Verify that spekterm's public-hygiene matcher (`hygieneHits` in the spekterm repository's `scripts/lib/public-hygiene.mjs`) reports `homePath: false` over every file under `openspec/`.

## 6. Verify the page

- [x] 6.1 Run `NODE_ENV=production npm run build:demo`. Open the result both served over HTTP and directly over `file://` in a headless browser with request logging: no request leaves the page's origin, and `document.fonts` reports the latin "Plus Jakarta Sans" face as `loaded` (not merely declared). Revert `docs/demo.html` afterwards (it is rebuilt only at release).
- [x] 6.2 Run spekterm's `hygieneHits` over the built page: `homePath: false` and no word hits. Verify with a script over the built file.
- [x] 6.3 Run `npm run type-check`, `npm run lint` and `npm test`. Verify all pass.
