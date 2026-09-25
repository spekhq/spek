## 1. Click guard

- [x] 1.1 Build the workspace packages the web tests import (`npm run build -w @spekjs/core && npm run build -w @spekjs/ui`), then add the pure link-click rule to `packages/web/src/utils/` (inputs: the anchor's `href` attribute, its resolved URL, the document URL, whether the click was already handled; output `pass` / `block`, per the table in design.md) with a `node:test` file covering every row of that table plus `href="#"`, a `vscode-webview://` in-app link, an `https://` in-app link and a `mailto:` link; verify with `npm test -w @spekjs/web`
- [x] 1.2 Install a bubble-phase `click` listener on `document` in `packages/web/src/main.webview.tsx` that finds the nearest `<a href>` in the composed path, applies the rule, and on `block` calls `preventDefault()` and `stopPropagation()`, with a comment stating why (VS Code's host script forwards every anchor click from a `window` listener); verify `npm run build:webview -w @spekjs/web` succeeds and `git diff --stat` shows no change to the Web, demo or IntelliJ entries

## 2. Verification

- [x] 2.1 Run the repo gates — `npm run type-check`, `npm run lint`, `npm test` — and confirm all pass
- [x] 2.2 Package the extension from this branch (`npm run build:webview -w @spekjs/web && npm run build -w spek-vscode`, then `cd packages/vscode && npx vsce package --no-dependencies`), install the `.vsix` in a GitHub Codespace opened in the browser, and confirm with no new tab opening at any step: sidebar "Changes" / "Specs" and a change card navigate; Enter on a focused sidebar link navigates; Ctrl-click on an in-app link does nothing; a spec TOC entry smooth-scrolls to its heading below the sticky header; a markdown `#fragment` link scrolls; a relative markdown link does nothing; an external `https://` link in rendered markdown still opens
- [x] 2.3 Install the same `.vsix` in desktop VS Code and confirm in-app navigation and external links behave as before, and the spec TOC scrolls as in 2.2
