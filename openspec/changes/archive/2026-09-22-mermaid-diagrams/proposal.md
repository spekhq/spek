# Proposal

## Why

OpenSpec design documents are where a project explains its shape, and the shape is usually a picture: an
architecture sketch, a request flow, a state machine. Mermaid is how that picture is written in Markdown,
and every surface an author might compare spek against — GitHub, GitLab, VS Code's own preview, Obsidian —
draws it. spek does not: a ` ```mermaid ` fence renders as syntax-highlighted source, so the one artifact
whose whole purpose is to be *looked at* is the one spek shows as text. `docs/feature-ideas.md` has listed
this as idea #2 since the file was written.

The same gap exists a level up. A change may hold a diagram as a file of its own — `flow.mmd` beside
`design.md` — and the scanner classifies root files by extension (`*.md`, `.yaml` / `.yml` / `.json`).
A `.mmd` file matches none of them, so it is not a tab, not counted in the artifact badge, and not
searchable. That is the same failure the `data` artifact kind fixed for `asyncapi.yaml`.

## What Changes

- **A ` ```mermaid ` fence renders as a diagram.** `MarkdownRenderer` delegates that one language to a
  diagram component instead of the syntax highlighter. Every Markdown artifact benefits at once —
  proposal, design, delta specs, main specs, tasks — on all four surfaces, because all four load the same
  SPA.
- **A root-level `.mmd` / `.mermaid` file becomes an artifact.** A new root kind joins `markdown`,
  `tasks` and `data` in the one `rootKind` classifier, so it is a tab, it counts toward the change's
  artifact badge, and it is in the search corpus — the three deriving from that classifier rather than
  from three lists kept in step. Discovery stays root-only and still skips dotfiles. The Kotlin mirror
  (`ArtifactFiles.kt` / `ArtifactDiscovery.kt`) gains the same kind, so IntelliJ stays at parity.
- **A diagram is readable when it does not fit.** A drawn diagram offers zoom and pan, and a toggle to
  the mermaid source it was drawn from. The source is always reachable: a diagram spek cannot draw is
  still a file the reader came to read.
- **A diagram that fails to parse shows its error and its source, and nothing else breaks.** Mermaid
  parses at draw time, and a document's other content — and the rest of the page — must be unaffected by
  one bad fence. spek is a viewer: it reports what the file says, including that it does not parse.
- **Diagram colour comes from the theme, not from mermaid's defaults.** Mermaid ships its own palette and
  writes it into the generated SVG, which is a colour mechanism the palette check has never seen. The
  diagram is themed from the project's own tokens and the check's enumeration accounts for the new
  mechanism, rather than reporting a conforming palette while a diagram sits at mermaid's contrast.
- **The Web build draws; the other three show diagram source.** On Web, mermaid is a lazy chunk a
  repository with no diagrams never fetches. The VS Code, IntelliJ and demo builds are single-file IIFE
  bundles that cannot code-split, so the same import is *inlined*: measured at **5.23 MB on top of a
  719 KB bundle**, which would take a `docs/demo.html` that is committed on every release from 4.5 MB to
  about 9.7 MB. Mermaid is therefore excluded from those three outright — absent, not merely unused —
  and they show the source, stated as how that surface shows a diagram rather than as a failure. No
  surface fetches mermaid from a CDN, which `demo-page` already forbids.
- **Untrusted diagram text is treated as untrusted.** Mermaid can emit author-supplied HTML into the
  page, and the VS Code and IntelliJ hosts render the SPA with more privilege than a browser tab. The
  diagram renders under mermaid's strict sanitization, and the webview CSP is verified against a real
  host rather than assumed.

A change holding no mermaid at all is unaffected: nothing new is discovered, and no mermaid code is
loaded.

## Capabilities

### New Capabilities

- `diagram-rendering`: what a mermaid diagram is in spek — where diagram source is recognised, how it is
  drawn, how it is themed, what a reader can do with one that does not fit, what happens when it fails to
  parse, and when the drawing code is loaded.

### Modified Capabilities

- `markdown-renderer`: a fenced block whose language is `mermaid` renders as a diagram rather than as
  syntax-highlighted code, and the existing highlighting rules state that exception rather than being
  silently overridden.
- `openspec-scanner`: root-level `.mmd` / `.mermaid` files are discovered as a diagram artifact kind,
  root-only and excluding dotfiles, from the same classifier that drives the artifact count.
- `change-browsing`: a diagram artifact renders as its own tab — drawn, with no table of contents and no
  folding, on the same terms as the `tasks` and `data` tabs.
- `search-semantics`: the corpus gains one document per root `.mmd` / `.mermaid` file, keeping the rule
  that an artifact which is displayed is an artifact which is searchable.
- `theme-toggle`: mermaid's generated SVG is a mechanism by which colour reaches the screen, so the
  palette check's enumeration either measures it or declares it, with the reason stated.

## Impact

- **`@spekjs/core`**: `ArtifactKind` gains a diagram member; `rootKind` and `RootKind` gain a case; a
  `DIAGRAM_EXTENSIONS` export joins `DATA_EXTENSIONS` so each host's file watcher derives its watched set
  from one source. `ChangeArtifact` keeps its shape, so the change is additive — **minor, not patch**.
- **`packages/web/src`**: a diagram component (dynamic import, theming, zoom/pan, source toggle, error
  state); a `mermaid` branch in `MarkdownRenderer`'s `code` component; a diagram branch in
  `ChangeDetail`'s artifact switch, which `assertNever` makes a compile error until it exists;
  `utils/dataArtifact.ts`'s tab-naming and Markdown-like predicates extended for the new kind.
- **`packages/web/server` and `packages/vscode/src/watcher.ts`**: `WATCHED_EXTENSIONS` picks up the
  diagram extensions, so editing a `.mmd` triggers a live refresh like editing a `.md`.
- **`packages/intellij`**: `ArtifactFiles.kt`, `ArtifactDiscovery.kt`, `SearchService.kt` and
  `WatchPolling.kt` mirror the new kind; the Kotlin `when` stays exhaustive.
- **Build and size**: a new `mermaid` dependency in `@spekjs/web`, reaching the Web build only. The three
  single-file configs set a build flag and alias `mermaid` to a stand-in, so their bundles are unchanged
  (measured: 718,653 → 719,158 bytes, +505). A test asserts both halves, because nothing else fails when
  a bundle is eight times too big.
- **Tests**: mermaid measures text to lay a diagram out and cannot draw under jsdom, so the diagram
  component's tests exercise its own states — loading, drawn, failed, source-toggled — against a stubbed
  mermaid, and the real draw is verified against a real browser, as the folding geometry already is.
- **Documentation**: `docs/feature-ideas.md` idea #2 is marked done on archive; `CLAUDE.md` gains the new
  root kind and the load-strategy decision. README and `docs/demo.html` are release-time, not
  archive-time.
