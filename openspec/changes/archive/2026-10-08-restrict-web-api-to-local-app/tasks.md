## 1. Web API server

- [x] 1.1 Add `packages/web/server/address.ts` exporting the API host (`127.0.0.1`), API port (`3001`), dev server port (`5173`), and the accepted `Host` / `Origin` sets derived from them; verify with `npm run type-check`
- [x] 1.2 Add the request guard middleware (foreign `Host` compared case-insensitively against the bound port, foreign `Origin`, `Sec-Fetch-Site` other than `same-origin` / `none` → 403 JSON) and split `server/index.ts` into `server/app.ts` (`createApp(port)`, `startServer(port?)` binding the API host and guarding the bound port) plus a thin `index.ts`; verify `npm run dev` starts the API on `127.0.0.1:3001`
- [x] 1.3 Remove `cors` / `@types/cors` from `@spekjs/web` (package.json + lockfile) and the `cors()` call; verify no `from "cors"` import and no `"cors"` / `"@types/cors"` dependency remain
- [x] 1.4 In `vite.config.ts`, point the `/api` proxy at the API host/port from `address.ts`, and set `host: "localhost"`, `strictPort: true` on port 5173 and `cors: false`; add `--kill-others-on-fail` to the `dev` script; verify `npm run build -w @spekjs/web`, and that with 5173 occupied `npm run dev` exits with an error
- [x] 1.5 Add `server/app.test.ts`, sending requests with `node:http` (fetch cannot set `Host`) against `startServer(0)`, covering: listen address is `127.0.0.1`; foreign `Host` (`evil.example`, `evil.example:<port>`, loopback without port, another port) → 403 and no route reached; missing `Host` refused; `localhost` / `127.0.0.1` / `LOCALHOST` / `[::1]` with the port → 200; foreign `Origin` (other localhost port, other scheme, `https://evil.example`, `null`) → 403; the app's own `Origin` under each loopback name → 200; `Sec-Fetch-Site: cross-site` / `same-site` → 403, `same-origin` / `none` → 200; the app's `POST /resync` with its own `Origin` answered; no `Access-Control-Allow-*` on a normal response or an `OPTIONS` preflight. Verify the tests pass

## 2. IntelliJ embedded server

- [x] 2.1 Override `isAccessible` in `SpekHttpRequestHandler` as `super.isAccessible(request)` plus the own-origin rule (`Origin`, when present, equals `http://` + `Host`; `Sec-Fetch-Site`, when present, is `same-origin` / `none`), and remove the handler's `Access-Control-Allow-*` headers; verify `./gradlew test`
- [x] 2.2 Add tests to `SpekHttpRequestHandlerTest.kt` calling `isAccessible`: no `Origin`, own `Origin`, `Sec-Fetch-Site: same-origin` / `none` admitted; `Origin: http://localhost:8080`, `https://evil.example`, `null`, `Sec-Fetch-Site: same-site` / `cross-site`, and `Host: evil.example` refused; verify `./gradlew test`

## 3. Verification

- [x] 3.1 Run the gates: `npm test`, `npm run type-check`, `npm run lint`, `npm run build`, `NODE_ENV=production npm run build:demo` (then revert `docs/demo.html`), and `./gradlew test` in `packages/intellij`
- [x] 3.2 Manual check against a running `npm run dev`: the app loads, lists a repository, opens a change and Refresh works; a `fetch` to `http://localhost:3001/api/fs/browse` (and to `http://localhost:5173/api/fs/browse`) from a page on another port is refused; `curl -H 'Host: evil.example' http://127.0.0.1:3001/api/fs/browse` returns 403; `curl` to the machine's LAN address on 3001 and 5173 is refused
- [x] 3.3 Manual check in a `runIde` sandbox: the built-in server serves `/api/spek/...` to a same-origin request and refuses one with `Origin: http://localhost:8080` or `Sec-Fetch-Site: same-site`; the webview page and the requests it makes on its own origin (including the Refresh `POST` with `Origin: http://localhost:<port>`) are served
