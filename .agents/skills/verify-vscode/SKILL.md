---
name: verify-vscode
description: Verify spek inside a real VS Code — desktop, or browser-hosted through `code serve-web` — covering the webview panel (Specs, Changes, Graph pages) and the native spek sidebar trees, by launching an isolated instance and driving it over the Chrome DevTools Protocol. Use after changing anything the VS Code panel or sidebar renders, when a task says "check it in a VS Code webview", or for bugs that only reproduce inside the host (host-injected styles, webview link handling, sidebar-to-panel navigation and heading jumps, keyboard shortcuts, worktree aggregation, live reload, light theme). Link clicks forwarded to the host (issue 59) show only in the browser-hosted mode.
license: MIT
compatibility: Verified on Linux with VS Code 1.140 (X11, Node 24) and 1.141 (GNOME on Wayland, VS Code on native Wayland, Node 26), with Chrome; macOS and Windows untested. Needs the `code` CLI and Node 22+; desktop mode needs a display, browser-hosted mode needs Chrome or Chromium and network access. No browser-automation tool needed.
metadata:
  author: spek
  version: "1.1"
---

Launch the extension from this checkout in a throwaway VS Code, open the spek panel, and read, click, or screenshot what it actually renders.
Unit tests render the SPA in jsdom or to static markup; neither has VS Code's injected stylesheet, its nested webview frames, or the native trees, so a host-only defect passes every test (see "Never leave a style unstated that a host will state for you" in `CLAUDE.md`).

`cdp.mjs` beside this file is the driver.
It talks to the DevTools endpoint with Node's built-in `WebSocket`, so nothing is installed, and it drives either host the same way.

## Pick a host

| | Desktop | Browser-hosted |
|---|---|---|
| How | Extension Development Host window | `code serve-web` + headless Chrome |
| Loads the extension from | `packages/vscode` (source build) | a packaged `.vsix`, reinstalled per build |
| Webview served from | `vscode-webview://` | `https://….vscode-cdn.net` |
| Link clicks forwarded to the host (issue 59) | invisible | visible |
| On the operator's screen | a window opens | nothing (headless) |
| Network | not needed | first run downloads the VS Code server; webviews are served from Microsoft's `vscode-cdn.net` (not tried offline) |
| Instructions | [resources/desktop.md](resources/desktop.md) | [resources/browser.md](resources/browser.md) |

Desktop is the default.
Use browser-hosted for anything about link handling, and before calling a webview change safe for code-server, Codespaces or vscode.dev users.
A green desktop run says nothing about link forwarding: with the link guard removed, a trusted click on an in-app link reached VS Code's `window` listener on desktop and the workbench opened nothing, while the same build in `serve-web` opened a new browser tab ("WebContentNotFound", `https://….vscode-cdn.net/changes`) (both measured on VS Code 1.140, Linux, 2026-10-06).

## 1. Set up

```bash
REPO=$(git rev-parse --show-toplevel)
SKILL=$REPO/.agents/skills/verify-vscode
RUN=$(mktemp -d)        # profile, workspace copy, screenshots
PORT=9333               # the DevTools port every cdp.mjs command talks to
cdp() { node "$SKILL/cdp.mjs" "$PORT" "$@"; }
```

Use your session scratchpad instead of `mktemp -d` when you have one.
Use a free `PORT`: `ss -ltn "sport = :$PORT" | tail -n +2` must print nothing.
If something already answers there, every later step drives that instead, and closing closes it (`cdp.mjs` checks only that a page there renders a VS Code workbench; read from its code).
If something listens but never answers, VS Code cannot bind the port, and a probe without a timeout (plain `curl`) hangs; see the close step of [resources/desktop.md](resources/desktop.md) for how that happens.

## 2. Build what the host will load

```bash
npm install            # a fresh checkout or worktree has no node_modules
npm run build:webview && npm run build:vscode
```

The root `build:webview` builds core, then ui, then the webview: web and the extension import core's and ui's `dist/`, not their source.
On a fresh checkout ui has no `dist/`, and building only core and the webview fails with `Can't resolve '@spekjs/ui/styles.css'`.
`packages/vscode/webview/` is a build artifact, and a stale one shows old UI while the source is already fixed — rebuild every time.
Browser-hosted mode also packages the build into a `.vsix`; see its resource file.

## 3. Pick a workspace and copy it

```bash
cp -r "$REPO/test-fixtures/nested-specs" "$RUN/ws"
```

`test-fixtures/nested-specs` is the shared fixture: six topics, nested (`contracts/pagination/streaming-search`) and same-named (`pagination` and `streaming-search` under both `contracts/` and `guides/`), one active change (`add-streaming-search`) and two archived ones, plus a hidden `.drafts/` spec and a root `specs/spec.md` that discovery must skip (`expected.json` beside it lists what every scanner must report).
Any repository with an `openspec/` directory works.
Copy it rather than opening it in place, so nothing VS Code writes (`.vscode/`) lands in the checkout, and so live-reload checks (step 8) can edit it freely.

## 4. Launch

Follow [resources/desktop.md](resources/desktop.md) or [resources/browser.md](resources/browser.md); each ends with VS Code answering on `$PORT`.

## 5. Open the panel or the sidebar

```bash
cdp palette "spek: Open spek"     # the webview panel
cdp palette "View: Show spek"     # the activity-bar tab: native Specs + Changes trees
```

`palette` opens the command palette with F1, which opened it on both hosts (measured 2026-10-06; Ctrl+Shift+P also opened it in headless Chrome).
After the panel opens, `cdp targets` lists an `iframe` target for the webview.
Check both surfaces when a change could affect either: the panel is the shared React SPA, the tab is `tree-provider.ts`.

## 6. Drive and read the webview

Click an app link by its `href` attribute (the dashboard's Specs link is a card whose text is more than "Specs", so route beats text):

```bash
cdp click-link /specs
```

`click-link` and the other `click-*` commands send real mouse events through the workbench page, so VS Code's own listeners see what they would see from a user — which matters for link handling.
`cdp click-app "<css selector>"` clicks any other app element, such as a button:

```bash
cdp click-app '[aria-label="Aggregation scope"] button[title^="Show only"]'
```

`app` evaluates one expression in the spek app's document, bound as `d`.
The webview target's own document is only VS Code's host frame; the app lives in its inner iframe, which the driver reaches for you.
An expression that comes out `null` or `undefined` prints that value, and means a missing element, not a missing app; "no webview held the spek app" means the panel is not open.

Read every row of the Specs tree, one line each:

```bash
cdp app '[...d.querySelectorAll("li > div:first-child")].map(r => r.innerText.replace(/\s+/g, " ").trim()).join("\n")'
```

`li > div` without `:first-child` also matches each item's nested-list wrapper and prints its subtree again.

Type into a React-controlled input — assigning `value` alone is invisible to React, so call the native setter and dispatch `input`:

```bash
cdp app '(i => { Object.getOwnPropertyDescriptor(d.defaultView.HTMLInputElement.prototype, "value").set.call(i, "guides/pag"); i.dispatchEvent(new d.defaultView.Event("input", { bubbles: true })); return "ok"; })(d.querySelector("input[placeholder=\"Filter specs...\"]"))'
```

### Keyboard

`key` presses a key and `type` inserts text, both wherever focus is — as a user's keys would — so click into the app first:

```bash
cdp click-app h1
cdp key Ctrl+K                 # the panel's search dialog
cdp type pagination
cdp key ArrowDown
cdp key Enter                  # opens the selected result
```

That sequence opened the dialog, typed into its input, and navigated to the second result (measured both hosts, 2026-10-06).
On desktop, with focus in the sidebar instead, Ctrl+K never reached the app: VS Code took it as the start of a chord ("Waiting for second key of chord").
Even with the app focused, VS Code also starts that chord, and the next real key is offered to both: `key a` after `key Ctrl+K` landed in the search input while the status bar reported "(Ctrl+K, A) is not a command".
A key that completes a bound chord would presumably also run that command (not tried).
`type` inserts text without key events, so it never meets a keybinding; use `key` for each character when keybindings are what you are checking.

## 7. Read and click the native trees

The sidebar trees are workbench DOM, not webview DOM:

```bash
cdp workbench '[...document.querySelectorAll("[id=\"workbench.view.extension.spek-sidebar\"] .monaco-list-row")].map(r => r.querySelector(".label-name")?.textContent + " " + (r.querySelector(".label-description")?.textContent ?? ""))'
cdp click-row 2026-02-01-add-guides
cdp expand-row guides
```

Scope to the spek view container: a bare `.monaco-list-row` also returns the command palette's history and notifications.
`click-row` and `expand-row` match the label a row displays (`.label-name`) — a change's slug, a spec's last segment, a heading without its `Requirement:` keyword.
Not the `aria-label`: VS Code fills that from the item's tooltip, which here is the topic path for a spec, the raw heading for a heading, and title plus date for a change (observed 2026-10-06).
Labels repeat — `pagination` under two folders, `Purpose` under every expanded spec — and the first rendered match wins, so expand only the folder you need.
Folders start collapsed; `expand-row` clicks the row's arrow, where `click-row` on a spec opens its page without expanding it.
A row's click opens its page in the panel, and opens the panel first when it is closed (`palette "View: Close All Editors"`, then `click-row`, reopened the panel on that change; measured both hosts, 2026-10-06).

A spec expands into its headings, and a heading row jumps the panel to that heading.
Check the jump on a spec long enough to scroll, or opening the page and jumping look the same:

```bash
cdp expand-row longspec
cdp click-row "deep anchor"
cdp app 'Math.round(d.defaultView.scrollY) + " " + Math.round(d.getElementById("requirement-deep-anchor").getBoundingClientRect().top)'
```

With a 150-paragraph `## Purpose` above `### Requirement: deep anchor`, clicking the spec row left `scrollY` at 0 with the heading 5886px down; clicking the heading row scrolled to 5160 and put it on screen (desktop; browser-hosted: 0 then 5257, measured 2026-10-06).
The fixture's specs are short enough that nothing scrolls, so add such a spec to the workspace copy first.

## 8. Check live reload

Edit the workspace copy from the shell, then read the page again:

```bash
mkdir -p "$RUN/ws/openspec/specs/billing" && printf '# billing\n\n## Purpose\n\nLive reload probe.\n' > "$RUN/ws/openspec/specs/billing/spec.md"
mv "$RUN/ws/openspec/specs/guides" "$RUN/ws/openspec/specs/handbook"
sleep 5
```

Both the panel's Specs page and the native tree picked up the new topic and the directory move within five seconds, on both hosts (measured 2026-10-06).
A directory move is the case worth keeping: live reload once missed it.

## 9. Check worktree aggregation

The header's aggregation-scope control renders only when the workspace has more than one git worktree, and the fixture is not a git repository.
Make the workspace copy one, with a worktree holding a change `main` does not have — before launching, since the window opens `$RUN/ws`:

```bash
git -C "$RUN/ws" init -q -b main && git -C "$RUN/ws" add -A && git -C "$RUN/ws" -c user.name=t -c user.email=t@t commit -qm fixture
git -C "$RUN/ws" worktree add -q "$RUN/ws-wt" -b feature
mkdir -p "$RUN/ws-wt/openspec/changes/worktree-only-change"
printf '## Why\n\nOnly on the feature worktree.\n' > "$RUN/ws-wt/openspec/changes/worktree-only-change/proposal.md"
git -C "$RUN/ws-wt" add -A && git -C "$RUN/ws-wt" -c user.name=t -c user.email=t@t commit -qm wt
```

Then, on the Changes page:

```bash
cdp app 'JSON.stringify([...d.querySelectorAll("[aria-label=\"Aggregation scope\"] button")].map(b => b.innerText + (b.getAttribute("aria-pressed") === "true" ? "*" : "")))'
cdp app 'JSON.stringify([...d.querySelectorAll("a[href^=\"/changes/\"]")].map(a => a.getAttribute("href").split("?")[0]))'
cdp click-app '[aria-label="Aggregation scope"] button[title^="Show only"]'
cat "$RUN/ws/.vscode/settings.json"
```

Check the list by its links: a card displays the slug with spaces (`worktree only change`), so searching the page text for `worktree-only-change` finds nothing even when it is listed.
On both hosts the control showed `Current dir` / `Worktrees*` and the links held `/changes/worktree-only-change`.
Clicking "Current dir" wrote `"spek.aggregateWorktrees": false` (and `"spek.aggregateJjWorkspaces": false`) into the workspace's `.vscode/settings.json` and dropped that change from the list; writing `true` back into the file from the shell flipped the control back and restored it within four seconds (measured 2026-10-06).
The jj option appears only when a jj workspace is detected; this recipe does not cover it.

## 10. Switch the theme

```bash
cdp palette "Preferences: Toggle between Light/Dark Themes"
cdp app 'd.body.className'    # vscode-light or vscode-dark
```

Check both themes when colours changed.
Desktop starts dark; the headless browser started light, probably following the browser's own colour scheme (observed, cause not established).
Toggle rather than pick from "Preferences: Color Theme": typing a theme name there and pressing Enter selected "Browse Additional Color Themes…" and left the marketplace picker open, while the panel showed only a preview of the theme, never saved (VS Code 1.140, whose built-in themes are "Dark 2026" and "Light 2026"; measured 2026-10-06).

## 11. Look at it

Always take a screenshot and look at it.
Text checks cannot see the host-only class of defect this skill exists for — a background injected by VS Code, a chip that turned dark inside a light panel.

```bash
cdp shot "$RUN/vscode.png"
```

## 12. Close

Follow the close step of the resource file for the host you launched.

## What this does not cover

- **macOS and Windows.** Every step was run on Linux only.
- **Remote and container workspaces** (Remote-SSH, Dev Containers, WSL), where the extension host runs elsewhere.
- **IntelliJ.** Its tool window loads the same SPA through JCEF and needs `./gradlew runIde` (see `CLAUDE.md`).
