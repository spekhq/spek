# web-api-access Specification

## Purpose
States who may reach the web app's API server: only the spek web app running on the same machine, never
another device on the network or a page from another web origin.

## Requirements

### Requirement: Loopback-only listening
The web app's API server SHALL listen on the IPv4 loopback address `127.0.0.1`, port `3001`, and on no other
address. The dev server's `/api` proxy SHALL target that address, so the app works without the API server
being reachable from any other interface.

#### Scenario: Listen address
- **WHEN** the API server is started the way `npm run dev` starts it
- **THEN** it is bound to `127.0.0.1` port `3001`

#### Scenario: Not reachable on a LAN address
- **WHEN** a client on the network connects to the machine's LAN address on port `3001`
- **THEN** the connection is refused, because nothing listens on that address

#### Scenario: The app still reaches the API through the proxy
- **WHEN** a developer runs `npm run dev`, opens `http://localhost:5173`, selects a repository and opens a
  change
- **THEN** every API call succeeds

### Requirement: Host header validation
The API server SHALL answer only requests whose `Host` header is `localhost`, `127.0.0.1` or `[::1]` followed
by the API server's port, with the host name compared case-insensitively. Any other `Host` — a loopback name
without the port, another port, or a domain name that resolves to a loopback address — SHALL receive HTTP 403,
and a request with no `Host` SHALL be refused with an HTTP 4xx status; neither SHALL reach any API route.
This guards against DNS rebinding, where a page from another site re-points its own host name at `127.0.0.1`
and then calls the API as a same-origin request.

#### Scenario: Request through a loopback name
- **WHEN** a request arrives with `Host: 127.0.0.1:3001`, `Host: localhost:3001`, `Host: LOCALHOST:3001` or
  `Host: [::1]:3001`
- **THEN** it is routed normally

#### Scenario: Foreign Host
- **WHEN** a request arrives with `Host: evil.example` or `Host: evil.example:3001`
- **THEN** the server responds HTTP 403 without listing, reading or detecting anything

#### Scenario: Missing Host
- **WHEN** a request arrives with no `Host` header
- **THEN** it is refused with an HTTP 4xx status and no route runs

### Requirement: Same-origin browser access only
The API server SHALL refuse with HTTP 403 any request whose `Origin` header is present and is not the web
app's own origin — `http://localhost:5173`, `http://127.0.0.1:5173` or `http://[::1]:5173` — including the
literal `null` origin and origins on other ports of the same machine. It SHALL likewise refuse a request whose
`Sec-Fetch-Site` header is present and is neither `same-origin` nor `none`, which covers requests a browser
sends from another site without an `Origin` header (a `<script>` or `<img>` source, a `no-cors` fetch).
Requests carrying neither header (non-browser clients such as `curl`, subject to the `Host` rule) SHALL be
answered.

The dev server SHALL refuse to start rather than move to another port when port `5173` is taken, so the app's
origin is always one the API admits; `npm run dev` SHALL then exit with an error rather than leave the API
running without an app.

#### Scenario: The app's own requests
- **WHEN** the app, loaded from `http://localhost:5173`, calls `/api/...` through the dev server's proxy,
  including the `POST` refresh request that carries `Origin: http://localhost:5173`
- **THEN** the request is answered normally

#### Scenario: Request from another origin
- **WHEN** a page served from another origin (for example `http://localhost:8080` or `https://evil.example`)
  calls `http://localhost:3001/api/fs/browse`
- **THEN** the server responds HTTP 403 and lists nothing

#### Scenario: Cross-site request without an Origin header
- **WHEN** a request arrives with `Sec-Fetch-Site: cross-site` or `Sec-Fetch-Site: same-site` and no `Origin`
- **THEN** the server responds HTTP 403

#### Scenario: Dev server port taken
- **WHEN** port `5173` is already in use and the developer runs `npm run dev`
- **THEN** the dev server reports the port in use and `npm run dev` exits with an error, instead of serving the
  app on another port

### Requirement: Loopback-only dev server
The dev server that serves the app and proxies `/api` SHALL listen on a loopback address only. Its proxy
rewrites `Host` to the API server's own, so the API's `Host` rule cannot see past it: a dev server reachable
from the network would reopen the API to the network. DNS rebinding against the dev server is refused by the
dev server's own host check.

#### Scenario: Dev server not reachable on a LAN address
- **WHEN** a client on the network connects to the machine's LAN address on port `5173`
- **THEN** the connection is refused

### Requirement: No cross-origin grant
The dev server SHALL NOT grant cross-origin access either: the app is same-origin with it.

The API server SHALL NOT send `Access-Control-Allow-Origin` or any other `Access-Control-Allow-*` response
header, on any response, including responses to `OPTIONS` requests.

#### Scenario: Preflight from another origin
- **WHEN** a browser sends an `OPTIONS` preflight for `/api/fs/browse` with `Origin: https://evil.example`
- **THEN** the response carries no `Access-Control-Allow-*` header

#### Scenario: Ordinary response
- **WHEN** the app's own request to `/api/openspec/changes` succeeds
- **THEN** the response carries no `Access-Control-Allow-Origin` header
