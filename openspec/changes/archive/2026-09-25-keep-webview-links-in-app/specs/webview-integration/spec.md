## ADDED Requirements

### Requirement: In-app links stay inside the webview
A link in the webview whose target resolves to the same scheme and host as the webview document (an in-app link)
SHALL NOT be handed to the VS Code host to open, whichever way it is clicked and whether VS Code runs on the desktop
or in a browser (code-server, GitHub Codespaces, vscode.dev). A click on an in-app link that the application handles
(a route link or a table-of-contents entry, clicked with the primary button and no modifier key) SHALL take effect
within the webview; any other click on an in-app link SHALL do nothing. Two kinds of link are exempt and keep their
current handling: a link to another scheme or host SHALL still be handed to the VS Code host to open, and a link
whose `href` consists only of a `#fragment` that the application does not handle SHALL still scroll within the
current page.

#### Scenario: Navigating in a browser-hosted VS Code
- **WHEN** the webview runs in a browser-hosted VS Code and the user clicks the sidebar's "Changes" link
- **THEN** the webview shows the Changes page and no new browser tab or window is opened

#### Scenario: Navigating by keyboard
- **WHEN** the webview runs in a browser-hosted VS Code and the user focuses the sidebar's "Specs" link and presses Enter
- **THEN** the webview shows the Specs page and no new browser tab or window is opened

#### Scenario: Navigating in desktop VS Code
- **WHEN** the webview runs in desktop VS Code and the user clicks any route link
- **THEN** the webview navigates to that route, as it did before this requirement

#### Scenario: Modified click on an in-app link
- **WHEN** the user clicks an in-app link while holding Ctrl, Cmd, Shift or Alt
- **THEN** no browser tab or window is opened and the webview stays on its current page

#### Scenario: Relative link in rendered markdown
- **WHEN** the user clicks a relative link in rendered markdown (e.g. `../other/spec.md`)
- **THEN** no browser tab or window is opened and the webview stays on its current page

#### Scenario: External link
- **WHEN** the user clicks a link in rendered markdown that points to another host (e.g. `https://github.com/...`)
- **THEN** the link is handed to the VS Code host, which opens it as it does today

#### Scenario: Fragment link in rendered markdown
- **WHEN** the user clicks a link in rendered markdown whose `href` is only a `#fragment` naming an element on the page
- **THEN** the page scrolls to that element and no browser tab or window is opened
