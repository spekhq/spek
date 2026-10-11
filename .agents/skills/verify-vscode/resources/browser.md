# Browser-hosted host

`code serve-web` runs a browser-hosted VS Code on localhost — the same class as code-server, Codespaces and vscode.dev — and headless Chrome renders it.
Its webviews are served from `https://….vscode-cdn.net` instead of desktop's `vscode-webview://`, which is what makes link clicks forwarded to the host (issue 59) visible.
Uses `REPO`, `SKILL`, `RUN`, `PORT` and `cdp` from step 1 of `SKILL.md`; `PORT` is Chrome's DevTools port here.

```bash
WEB=8123                                                   # serve-web's HTTP port
CACHE=${XDG_CACHE_HOME:-$HOME/.cache}/spek-verify-vscode    # the downloaded VS Code server, reused across runs
CHROME=$(command -v google-chrome-stable || command -v google-chrome || command -v chromium)
```

Only `google-chrome-stable` has been run; Chromium should behave the same but is untested.

## Package

The server loads an installed extension, not the source tree, so package the build from step 2:

```bash
(cd "$REPO/packages/vscode" && npx vsce package --no-dependencies -o "$RUN/spek.vsix")
```

## Launch

Start the server in a session of its own, recording its process group for the close step:

```bash
node -e 'process.stdout.write(require("crypto").randomBytes(16).toString("hex"))' > "$RUN/token"
setsid -f sh -c 'echo $$ > "$1/serve.pgid"; exec code serve-web --port "$2" --connection-token-file "$1/token" --accept-server-license-terms --server-data-dir "$1/server" --cli-data-dir "$3" --disable-telemetry' \
  sh "$RUN" "$WEB" "$CACHE" > "$RUN/serve.log" 2>&1
SERVER="$CACHE/serve-web/$(code --version | sed -n 2p)"
until [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$WEB/?tkn=$(cat "$RUN/token")")" = 302 ]; do sleep 1; done
```

- Every request must carry the connection token (`code serve-web --help`), and the server listens on localhost by default.
- The first run downloads the VS Code server matching the installed `code` into `$CACHE` (15–30 seconds here); later runs reuse it.
  A request starts that download, so the loop's own `curl` is what starts it — gate nothing in front of it.
  While downloading, the server answered 202; once it ran, 302 (observed 2026-10-06).
  Stopping at any successful answer is too early: the 202 comes before the server's files exist, and the install below needs them.
- `--accept-server-license-terms` accepts the VS Code Server license on the operator's behalf. Say so before the first run.

Install the extension with the server's own CLI, then open the workspace in headless Chrome:

```bash
"$SERVER/bin/code-server" --server-data-dir "$RUN/server" --install-extension "$RUN/spek.vsix"
"$CHROME" --headless=new --remote-debugging-port=$PORT --user-data-dir="$RUN/chrome" --window-size=1600,1000 \
  --no-first-run --no-default-browser-check "http://127.0.0.1:$WEB/?tkn=$(cat "$RUN/token")&folder=$RUN/ws" > "$RUN/chrome.log" 2>&1 &
until cdp workbench '"up"' 2>/dev/null; do sleep 1; done; sleep 4
```

Then trust the folder.
It opens in Restricted Mode, and spek declares no untrusted-workspace support, so until then the spek icon and commands are missing — and `palette "spek: Open spek"` silently runs whatever command matches instead.
Writing `security.workspace.trust.enabled` into the server's `User/settings.json` did not change that; the trust editor does:

```bash
cdp palette "Workspaces: Manage Workspace Trust"
cdp click ".workspace-trust-editor .monaco-button"   # the first button is "Trust"
```

## After changing the code

Rebuild (step 2), package again, reinstall over the old copy, and reload the page; then open the panel again:

```bash
(cd "$REPO/packages/vscode" && npx vsce package --no-dependencies -o "$RUN/spek.vsix")
"$SERVER/bin/code-server" --server-data-dir "$RUN/server" --install-extension "$RUN/spek.vsix" --force
cdp workbench 'location.reload()'
```

## Check that link clicks stay in the panel

```bash
cdp targets
cdp click-link /changes
sleep 3
cdp targets
```

The second listing must hold the same `page` targets as the first.
A forwarded click shows up as an extra `page` — with the link guard removed it was titled "WebContentNotFound", at `https://….vscode-cdn.net/changes` (measured 2026-10-06).

## Close

```bash
cdp close                                   # Chrome
kill -TERM -- -"$(cat "$RUN/serve.pgid")"   # serve-web and the VS Code server it started
```

Kill the process group, not the PID of `code serve-web`: killing the launcher's processes left the server it had started running, reparented to PID 1, still holding its extension hosts.
The group kill stopped every process and freed the port (both measured on Linux, VS Code 1.140, 2026-10-06).
