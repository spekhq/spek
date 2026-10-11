## Context

See proposal.md — Why. The relevant mechanics, read from VS Code's webview host script
(`vs/workbench/contrib/webview/browser/pre/index.html`, VS Code 1.134.0):

- VS Code writes the extension's HTML straight into the webview frame's document (`contentDocument.open()` /
  `write()`), then registers `handleInnerClick` as a **bubble-phase `click` listener on that frame's `window`** — the
  last stop of a click's propagation path, in the same document as spek's page.
- `handleInnerClick` ignores untrusted events, then takes the nearest `<a href>` in the composed path: for
  `href="#"` it scrolls to the top; for a fragment link (`getAttribute('href') === node.hash`) it calls
  `scrollIntoView()` on the matching id; otherwise it posts `did-click-link` with the resolved `href`. In every case
  it then calls `preventDefault()`. It never reads `event.defaultPrevented`.
- Middle clicks fire `auxclick`, not `click`; `handleAuxClick` already `preventDefault`s them on any link and posts
  nothing.
- The workbench opens a forwarded URI only if its scheme is `http`, `https`, `mailto`, `vscode` / `vscode-insider`
  or the product's own URL scheme (plus `command` when enabled). Desktop's `vscode-webview://` fails that test; a
  browser-hosted workbench's `https://` passes it.

Every in-app route link in spek is a React Router `<Link>` / `NavLink` rendering `<a href="/changes">` etc. Under the
webview's `MemoryRouter` that `href` is never navigated to — it resolves against the webview document. The SPA has
no portals, so React's click listener on the `#root` container sees every click before `document` does.

## Goals / Non-Goals

**Goals:**
- No click on an in-app link reaches the VS Code host, in desktop or browser-hosted VS Code.
- External links and markdown `#fragment` links behave exactly as today.

**Non-Goals:**
- Making modified clicks on an in-app link do something useful (open a second spek panel, etc.). They become a no-op,
  which is what desktop VS Code already does.
- Relative links inside rendered markdown (e.g. `../other/spec.md`). They resolve to the webview's scheme and host,
  so they fall under the same rule and become a no-op — what desktop VS Code does today. Resolving them to a spek
  route is a separate feature.
- The Web app, demo and IntelliJ tool window: no VS Code host script runs there, and none of them changes.

## Decisions

**Guard in the webview, not a change to how links are rendered.** A `click` listener on `document` in the bubble
phase runs after React (whose listeners sit on the root container, below `document`) and before VS Code's listener on
`window`. Calling `stopPropagation()` there keeps the click from ever reaching the host script.
Alternatives considered:
- *Render in-app links without an `href`, or with `href="#"`, in the webview.* Touches every `<Link>` / `NavLink`
  across shared components and loses the semantics of a link (focus, the accessible role); `href="#"` would also make
  VS Code scroll the page to the top.
- *Capture-phase listener on `window` that stops the click.* A capture-phase stop on `window` stops the event before
  it reaches React, so the app would never navigate.
- *Ask the extension host to ignore the forwarded link.* The host script posts to the workbench, not to the
  extension; the extension never sees `did-click-link`.

**"In-app" means the resolved URL has the webview document's protocol and host.** Not `URL.origin`: for
a non-special scheme such as `vscode-webview:` the origin serialises as `"null"`
(`new URL("/changes", "vscode-webview://abc123/index.html").origin === "null"`), so comparing origins would treat
every desktop link as external. Protocol + host holds for both `vscode-webview://<id>` and `https://…`.

**The decision is a pure function with two results; the listener is a thin shell.** `packages/web` tests run under
`node:test` with no DOM, so the rule — given the anchor's `href` attribute, its resolved URL, the document URL and
whether the click was already handled, return `pass` or `block` — lives in `src/utils/` with unit tests, and
`main.webview.tsx` only finds the anchor, calls the rule and, on `block`, calls `preventDefault()` and
`stopPropagation()`. Calling `preventDefault()` on a click the app already prevented is a no-op, so one result
covers both "the app handled it" and "nothing may open it".

| Link | Click already handled by the app | Result | Why |
|---|---|---|---|
| different protocol or host (incl. `mailto:`) | any | `pass` | VS Code opens it, as today |
| `href` is only a `#fragment`, including `href="#"` | no | `pass` | VS Code's own scroll (to the id, or to the top), as today |
| `href` is only a `#fragment` | yes | `block` | the app scrolled itself (the spec TOC) |
| any other in-app link | any | `block` | the app navigated, or nothing may open it |

`block` needs the `preventDefault()` for the unhandled case: VS Code's listener is what currently suppresses the
browser's default navigation, and once the click no longer reaches it an unprevented click would navigate the frame
itself. `auxclick` is outside the guard — VS Code already neutralises middle clicks on links without forwarding them.

**Fragment links the app does not handle are left to VS Code.** The alternative — have the guard scroll them itself
with the app's `scrollToAnchorId` and block them too — would make in-app links depend on nothing in VS Code's host
script, and would give markdown fragment links the TOC's sticky-header offset and fold-reveal. It is a behaviour
change to a link kind this fix is not about, so it stays out; it is the next step if VS Code's fragment handling is
ever found wanting.

**The spec TOC's scroll changes, for the better.** `SpecToc` prevents the click and runs its own smooth,
offset-aware scroll. Today VS Code's handler then sees `href="#slug"` and calls `scrollIntoView()`, an instant jump
that cuts the smooth scroll short and lands without the sticky-header offset. Blocked at `document`, the click never
reaches it, so in VS Code the TOC now scrolls the way it does in the Web app. (Ordering read from source; the visual
result is confirmed in task 2.2.)

**Only the VS Code entry installs it.** The guard exists because of the VS Code host script; installing it in the Web
or IntelliJ entry would change behaviour there (a Ctrl-click that opens a new browser tab in the Web app is correct).

## Risks / Trade-offs

- [VS Code moves its listener to `document` or to the capture phase] → the guard stops working and the bug returns
  in browser-hosted VS Code only, silently. Mitigation: the guard's reason is stated in the source and the verify step
  is a real browser-hosted run; a regression is a report like #59, not data loss.
- [A future app feature adds its own `window`-level `click` listener] → it would not see clicks on in-app links.
  None exists today (no `window` / `document` click listeners in `packages/web` or `packages/ui`).
- [code-server serves webviews from the workbench's own host] (the #59 screenshot's stray tab is on the workbench's
  host) → a markdown link pointing at that host counts as in-app and becomes a no-op. Such a link would open the IDE
  itself inside a spec; accepted.
- [Unit tests cannot prove the listener ordering] → verified by running the packaged extension in a browser-hosted
  VS Code (Codespaces), the environment the bug reproduces in.
