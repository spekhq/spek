## Why

The web app's API server answers anyone who can reach port 3001. `app.listen(3001)` binds every
interface and `cors()` sends `Access-Control-Allow-Origin: *`, so while someone runs `npm run dev`, another
device on the same network — or any web page open in their browser — can call `GET /api/fs/browse` to list
directories anywhere on the machine and read OpenSpec content under any path. spek is described as a local
read-only viewer, and the spek documentation on spekterm.com is about to state what it does on the network;
the behavior has to be fixed before it is stated.

None of this access is needed: the SPA calls a relative `/api`, which the Vite dev server proxies to the API
server, so every legitimate browser request is same-origin from the page's point of view.

## What Changes

- The web API server listens on the loopback address only (`127.0.0.1:3001`), and the Vite proxy targets that
  address.
- The web API server refuses (HTTP 403) a request whose `Host` header does not name the API server through a
  loopback name (`localhost`, `127.0.0.1`, `[::1]`) and its port — the DNS-rebinding guard.
- The web API server refuses (HTTP 403) a request carrying an `Origin` header other than the app's own dev
  origin, or a `Sec-Fetch-Site` header other than `same-origin` / `none` — so a page from another origin,
  including another port on `localhost`, cannot use it.
- The permissive `cors()` middleware is removed, along with the `cors` / `@types/cors` dependencies. The API
  sends no `Access-Control-Allow-*` headers.
- The Vite dev server uses a fixed port (`strictPort`): the API admits exactly one app origin, so a dev server
  that silently moved to 5174 would be refused by its own API. **BREAKING (dev only)**: `npm run dev` now
  fails to start when port 5173 is taken instead of moving to the next free port.
- IntelliJ: the embedded handler refuses any request whose `Origin` is not the built-in server's own, or whose
  `Sec-Fetch-Site` is not `same-origin` / `none`. The IDE already refuses foreign host names and foreign
  sites, but it admits a page on any other local port and echoes that page's `Origin` back as
  `Access-Control-Allow-Origin`, so another local page could read the API. The handler's own
  `Access-Control-Allow-Origin: *` is removed as well. The tool window and the external-browser fallback both
  load the SPA from the built-in server itself, so their requests are same-origin and unaffected.
- The dev server's `npm run dev` script stops both processes when one fails, and the Vite dev server states
  loopback-only listening and no CORS explicitly instead of relying on defaults.

## Capabilities

### New Capabilities
- `web-api-access`: who may reach the web app's API server — loopback-only listening, `Host` validation,
  same-origin-only browser access, and no CORS grant.

### Modified Capabilities
- `intellij-embedded-server`: the "CORS headers for JCEF" requirement is removed and replaced by one stating
  that the handler serves only requests from the built-in server's own origin.

## Impact

- **Code**: `packages/web/server/index.ts` (split into an app factory plus a listen entry so it can be tested),
  a new request guard under `packages/web/server/`, `packages/web/vite.config.ts` (proxy target, strict port),
  `packages/web/package.json` (`dev` script), `packages/intellij/.../server/SpekHttpRequestHandler.kt`
  (request admission, response headers).
- **Dependencies**: `cors` and `@types/cors` removed from `@spekjs/web` (a private package; nothing published).
- **Hosts**: Web (dev server) and IntelliJ. VS Code calls `@spekjs/core` in the extension host and has no HTTP
  server; the Demo is static.
- **Users**: anyone who reached the dev API from another machine (e.g. a phone on the LAN) or from another
  local page loses that access — by design. Release notes should say the API is now local-only, and that a
  busy port 5173 now stops `npm run dev` with an error.
- **Docs at archive**: `CLAUDE.md` (Security bullet), `docs/prd.md`.
