## Why

In VS Code running in a browser — code-server, GitHub Codespaces, vscode.dev — every click on spek's in-app
navigation (the sidebar's Overview / Specs / Changes, a change card, a spec link) also opens a new browser tab at
`https://<webview-host>/changes` and similar, which is a 404 (issue #59, reproduced in Codespaces against the
Marketplace build 1.18.0). The page inside the webview does navigate; the stray tab comes on top of it.

VS Code wraps every webview in its own host script, which forwards **every** anchor click to the workbench as a link
to open — whether or not the page already handled that click. Desktop VS Code serves the webview from a
`vscode-webview://` origin, a scheme the workbench refuses to open, so the forwarded link is dropped silently and the
bug never showed. In a browser the webview is served from `https://`, which the workbench does open.

## What Changes

- A click on a link that points inside the webview (one resolving to the webview document's own scheme and host) is
  no longer forwarded to the VS Code host, in any VS Code.
- A plain click on an in-app route link keeps navigating inside the webview, exactly as today.
- Any other click on an in-app link — a modified click (Ctrl / Cmd / Shift / Alt), or a relative link in rendered
  markdown such as `../other/spec.md` — does nothing, instead of opening a broken tab in a browser-hosted VS Code.
  This is what desktop VS Code already does for them.
- The spec page's table of contents scrolls with spek's own offset-aware smooth scroll in VS Code too. Today VS Code's
  handler cuts that scroll short with an instant jump of its own; once the click no longer reaches it, spek's wins.
- Unchanged: an external link (another scheme or host) is still handed to VS Code to open; a `#fragment` link in
  rendered markdown still scrolls within the page; the Web app, the demo and the IntelliJ tool window are untouched (no VS Code host
  script runs there).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `webview-integration`: adds a requirement that in-app links stay inside the webview and are never forwarded to the
  VS Code host, while external and same-document fragment links keep their current handling.

## Impact

- `packages/web`: the VS Code webview entry (`main.webview.tsx`) installs a document-level click guard; the decision
  of which clicks it keeps is a pure helper with unit tests. No change to shared components, routes, or the other
  three hosts' entries.
- `packages/vscode`: no source change; the fix ships in the webview bundle its publish workflow already builds.
- Product line only (VS Code channel). `@spekjs/core` / `@spekjs/ui` are untouched.
