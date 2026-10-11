## ADDED Requirements

### Requirement: Same-origin access only
The handler SHALL serve a request — API or webview resource — only when it comes from the built-in server's
own origin. On top of the IDE built-in server's own admission (a `Host` naming a local host, and an `Origin` /
`Referer`, when present, naming a local host), the handler SHALL refuse a request whose `Origin` header is
present and is not `http://` followed by the request's `Host` (compared case-insensitively), and a request whose
`Sec-Fetch-Site` header is present and is neither `same-origin` nor `none`.

The platform's admission compares host names without ports, so it admits a page served on any other local port,
and the built-in server echoes each request's `Origin` back as `Access-Control-Allow-Origin`. Refusing the
request is therefore the only control that stops another local page from reading the API. The tool window and
the external-browser fallback both load the SPA from the built-in server and call it on the same origin, so they
are unaffected.

The handler SHALL NOT itself add `Access-Control-Allow-*` headers. The platform may still add them to a refused
response; such a response carries no API data.

#### Scenario: The plugin's own requests
- **WHEN** the tool window's webview, loaded from `http://localhost:{port}/spek/webview/`, requests
  `GET /api/spek/openspec/changes?projectPath=...` or sends the Refresh `POST /api/spek/openspec/resync` with
  `Origin: http://localhost:{port}`
- **THEN** the request is served

#### Scenario: Another local port
- **WHEN** a page served from `http://localhost:8080` requests `http://localhost:{port}/api/spek/openspec/changes`
- **THEN** the handler does not serve it

#### Scenario: Cross-site request without an Origin
- **WHEN** a request arrives with `Sec-Fetch-Site: same-site` or `Sec-Fetch-Site: cross-site`
- **THEN** the handler does not serve it

#### Scenario: Foreign Host
- **WHEN** a request arrives with `Host: evil.example`
- **THEN** the handler does not serve it

## REMOVED Requirements

### Requirement: CORS headers for JCEF
**Reason**: The webview is never loaded from `file://` or another origin: the tool window and the
external-browser fallback both load `http://localhost:{port}/spek/webview/...` from the built-in server and call
`http://localhost:{port}/api/spek`, which is the same origin. The header served no host, and granting
cross-origin access is the opposite of what the API needs.
**Migration**: None. The plugin's own webview keeps working unchanged; other local pages lose access by design
(see "Same-origin access only").
