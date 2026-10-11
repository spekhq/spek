## Context

See proposal.md for why. The relevant current state:

- `packages/web/server/index.ts` builds the Express app and calls `app.listen(3001)` at import time, which is
  why the route tests mount routers on a throwaway app instead of importing it. Nothing in the server can be
  tested as the app `npm run dev` actually runs.
- The SPA reaches the API only as `/api/...` on its own origin; `packages/web/vite.config.ts` proxies `/api` to
  `http://localhost:3001` with `changeOrigin: true`, which rewrites `Host` to the proxy target's host and port.
  The proxy forwards `Origin` and `Sec-Fetch-*` untouched.
- Browsers send `Origin` on every cross-origin `cors`-mode request and on every non-`GET`/`HEAD` request, but
  not on a same-origin `GET` (so most of the app's own calls carry none) and not on a `no-cors` `GET` such as a
  `<script src>`. Chromium, Firefox and Safari send `Sec-Fetch-Site` on every request over a potentially
  trustworthy URL, which `http://localhost` and `http://127.0.0.1` are.
- Vite 6.4 already validates `Host` on its own dev server and restricts its own CORS to loopback origins, but
  it proxies `/api` for any loopback origin on any port, so the API cannot rely on it.
- IntelliJ: `SpekHttpRequestHandler` runs inside the IDE's built-in server. Disassembling the 2023.3.8
  platform (`app-client.jar`, the oldest IDE in our range) shows the dispatcher
  (`DelegatingHttpRequestHandler`) calls `HttpRequestHandler.isAccessible(request)` before `process`, and the
  default `isAccessible` requires the `Host` to be a local host and `isOriginAllowed` not to be `FORBID`; the
  default `isOriginAllowed` is `isLocalOrigin`, which checks `Origin` and `Referer`. spek does not override
  either. That check compares host names only, not ports — so a page on another `localhost` port passes it.
  And the built-in server's pipeline (`NettyUtil.addHttpServerCodec`) installs Netty's `CorsHandler` configured
  `forAnyOrigin().allowCredentials().allowNullOrigin()`, which echoes every request's `Origin` back as
  `Access-Control-Allow-Origin` on the way out, overwriting whatever the handler wrote. The handler's own `*`
  is therefore not what grants access, and removing it alone changes nothing.

## Goals / Non-Goals

**Goals:**
- The web API is unreachable from other machines and unusable from any page but the app's own.
- Each rule is enforced in exactly one place and tested against the app as `npm run dev` runs it.
- The address constants live in one module read by both the server and the Vite config, so the proxy target
  and the admitted origin cannot drift from the listen address and the dev port.

**Non-Goals:**
- Narrowing *what* `/api/fs/browse` may list or which `dir` the openspec routes accept. The repo picker needs
  to browse the whole filesystem; the fix is about *who* may ask, not *what* they may ask for.
- Authentication tokens. With the server reachable only from the machine and only from the app's origin, a
  token would defend against local processes, which can read the user's files directly anyway.
- Widening IntelliJ's request admission, or the IDE's "Can accept external connections" setting
  (`builtInServerAvailableExternally`, default off) — that is the user's IDE configuration. spek only narrows.
- A production web server. There is none: the web surface is `npm run dev` only.

## Decisions

### D1. Listen on `127.0.0.1`, and point the proxy at the same literal address

`localhost` resolves to `::1` first on some systems and to `127.0.0.1` on others, and Node's resolver order
has changed across versions, so binding or proxying by name risks the two sides disagreeing (the proxy getting
`ECONNREFUSED` on `::1` while the server waits on `127.0.0.1`). A literal on both sides removes the question.
IPv4 loopback is chosen over `::1` because it exists on every machine, including containers with IPv6
disabled. Binding both loopback addresses was considered and rejected: one is sufficient for the proxy, and a
second listener is a second thing to keep restricted.

### D2. One address module shared by server and Vite config

`server/address.ts` exports the API host and port, the dev server port, and the derived allowlists (accepted
`Host` values, accepted `Origin` values). `vite.config.ts` imports the ports and API host from it. Hand-copying
`3001` / `5173` into the guard was the alternative; it would let a port change in one file silently lock the app
out of its own API — the failure would look like "the API is down".

### D3. A guard middleware first in the chain, answering 403

The app factory installs one middleware before `express.json()` and every router. It refuses with 403 and a
JSON `{ error }` body when:
1. `Host` is not in the accepted set (`localhost`, `127.0.0.1`, `[::1]`, each with the port the server is
   actually bound to; compared case-insensitively, since Express keeps the header's spelling). An HTTP/1.1
   request with no `Host` never reaches the guard — Node's parser answers it 400 (`requireHostHeader`) — and an
   HTTP/1.0 one is refused by the guard.
2. `Origin` is present and not one of `http://localhost:5173`, `http://127.0.0.1:5173`, `http://[::1]:5173`.
   The literal `null` is not in the set.
3. `Sec-Fetch-Site` is present and not `same-origin` or `none`. `same-site` is refused deliberately: sites
   ignore ports, so every other `localhost` port is "same-site".

Through the proxy, the app's requests arrive with `Host: 127.0.0.1:3001` (rewritten by `changeOrigin`), no
`Origin` or the app's own, and `Sec-Fetch-Site: same-origin`, so they pass all three. A request with none of
the browser headers (curl, scripts) passes rules 2 and 3 and is subject only to rule 1.

Because the proxy rewrites `Host`, rule 1 sees nothing of a request that came through the dev server: against
the dev server, DNS rebinding is refused by Vite's own host check (`allowedHosts`, which runs before the proxy),
and network exposure is prevented only by the dev server listening on loopback — see D8.

Alternatives: the `cors` package with an origin allowlist only *withholds the response header* — the request
still runs and a `no-cors` request still gets its side effects — so it does not satisfy "refused". Vite's
`allowedHosts` covers the dev server, not the API port.

### D4. Remove `cors` and its types

With D3 nothing needs a CORS grant; keeping the package configured "safely" invites someone to re-widen it.
`OPTIONS` requests fall through to Express's default handling, which sends no `Access-Control-Allow-*`.

### D5. `strictPort: true` on the Vite dev server

D3 admits exactly one app origin. Without `strictPort`, Vite moves to 5174 when 5173 is busy and the app's
`POST /resync` (the one request that carries `Origin`) is refused — silently, because the refresh invariant
swallows a resync failure, so the only symptom is a cache that was not cleared. Failing to start with "port in
use" is the honest outcome. Accepting any loopback origin instead was rejected: it is exactly the "other local
page" the acceptance criteria require us to refuse.

`npm run dev` runs Vite and the API under `concurrently`, which by default keeps running while either side is
alive — so a Vite that exits leaves the API running and the command hanging. The script gains
`--kill-others-on-fail`, so a refused port ends the whole command with an error.

### D6. Split `server/index.ts` into an app factory and a start function

`server/app.ts` exports `createApp(port)` (guard + routers) and `startServer(port?)` (listens on the API host,
then attaches the app built for the port actually bound, resolving the `http.Server`). `server/index.ts` only calls `startServer()`. Tests import
`createApp()` for the guard and `startServer(0)` for the listen address, so they exercise the same wiring
`npm run dev` runs. The port parameter exists only so a test can bind an ephemeral port; the host is not a
parameter, so no caller can widen it.

### D7. IntelliJ: refuse other origins in `isAccessible`; withholding headers cannot work

The platform's `CorsHandler` echoes any `Origin` (see Context), so no response header the handler writes or
omits can stop a cross-origin read; and the platform's admission lets any local port through. The handler
therefore overrides `isAccessible` as `super.isAccessible(request) && isOwnOrigin(headers)`: an `Origin`, when
present, must equal `http://` + the request's `Host` (case-insensitively), and a `Sec-Fetch-Site`, when present,
must be `same-origin` or `none` (the latter is the external-browser fallback's navigation). Only narrowing —
`super` stays the first test, so the platform's `Host` / local-origin rules still apply underneath.

The tool window (`JcefWebviewHost.loadUrl`) and the external-browser fallback both load from
`http://localhost:{port}/spek/webview/` with `apiBase` on the same origin; the readiness probe uses
`HttpURLConnection`, which sends no `Origin`. All three pass.

The handler's three `Access-Control-Allow-*` writes are removed too — they never granted anything the platform
did not, but they read as intent. A refused request may still get an echoed header from the platform; its body
carries no API data.

Tests call `isAccessible` directly (it needs no `Application`: `getHostName` and `NetUtils.isLocalhost` are pure)
— own origin admitted, other local port / foreign / `null` origin and `same-site` / `cross-site` refused,
foreign `Host` refused. The platform internals above were read from 2023.3.8, the oldest IDE in range and the
`runIde` target; newer IDEs are not verified, and the override holds regardless of what their pipeline adds.

### D8. The dev server states loopback and no CORS

`vite.config.ts` sets `server.host: "localhost"` (Vite's default today, stated because D3's `Host` rule depends
on it) and `server.cors: false` (Vite otherwise answers other loopback origins with an echoed
`Access-Control-Allow-Origin`; the app is same-origin and needs none). Someone running with `--host` for a
devcontainer re-exposes the API through the proxy; that is an explicit choice on their part, and this design
does not try to defeat it.

## Risks / Trade-offs

- [Someone used the dev server from a phone or another machine on the LAN] → That access is what this change
  removes. Release notes state it; anyone who wants it can run their own tunnel, and the decision to expose
  their filesystem is then explicitly theirs.
- [Port 5173 busy now stops `npm run dev`] → The error names the port; release notes mention it. This includes
  running two `npm run dev` at once from two worktrees, which used to half-work (the second Vite moved to 5174
  and proxied to the first API, which serves any `dir`): the second now fails. One dev server can browse every
  worktree, so the remedy is to use the one already running.
- [A devcontainer that forwards 5173 to a different local port] → The browser's `Origin` then names the
  forwarded port and only the app's `POST /resync` is refused, silently (the refresh invariant swallows it), so
  a manual Refresh does not clear the timestamp cache. Accepted; forwarding to the same port avoids it.
- [Residual reach of a request that slips through] → The API's `GET` routes are not side-effect free: they run
  `git` and the `openspec` CLI with the caller's `dir` as working directory and `/watch` starts a file watcher
  there, and running `git` in an untrusted directory is a known attack surface. That is why D3 refuses requests
  rather than withholding CORS headers, and why `Sec-Fetch-Site` is checked: a cross-site `no-cors` request
  carries no `Origin`. A browser sending neither header on such a request would still reach a route; current
  engines send `Sec-Fetch-Site` to `localhost`.
- [IntelliJ admission is platform behavior that could change in a future IDE] → The override narrows whatever
  `super` decides, and the tests pin the narrowing.

## Migration Plan

No data or configuration to migrate. Rollback is reverting the commit. Releases: the web change ships with the
next product release; the IntelliJ change ships with the next plugin release.
