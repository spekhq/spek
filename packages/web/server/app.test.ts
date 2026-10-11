import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { startServer } from "./app.js";
import { API_HOST, APP_PORT } from "./address.js";

// The server as `npm run dev` starts it, on an ephemeral port. Requests go through http.request rather than
// fetch, because fetch will not send a caller-chosen Host header — and Host is half of what is under test.
let server: Server;
let port: number;

before(async () => {
  server = await startServer(0);
  port = (server.address() as AddressInfo).port;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/** `host: null` sends no Host header at all; `undefined` sends the ordinary `127.0.0.1:<port>`. */
function request(
  path: string,
  opts: { method?: string; host?: string | null; headers?: Record<string, string> } = {},
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { ...opts.headers };
    const req = http.request(
      {
        host: API_HOST,
        port,
        path,
        method: opts.method ?? "GET",
        headers,
        setHost: opts.host !== null,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      },
    );
    if (typeof opts.host === "string") req.setHeader("Host", opts.host);
    req.on("error", reject);
    req.end();
  });
}

const BROWSE = "/api/fs/browse";

function assertNoCorsGrant(reply: Reply) {
  for (const name of Object.keys(reply.headers)) {
    assert.ok(!name.startsWith("access-control-allow-"), `unexpected ${name} header`);
  }
}

test("listens on the IPv4 loopback address only", () => {
  const address = server.address() as AddressInfo;
  assert.equal(address.address, "127.0.0.1");
});

test("answers the loopback Host names with the API port", async () => {
  for (const host of [`127.0.0.1:${port}`, `localhost:${port}`, `LOCALHOST:${port}`, `[::1]:${port}`]) {
    const reply = await request(BROWSE, { host });
    assert.equal(reply.status, 200, host);
    assert.ok(Array.isArray(JSON.parse(reply.body).entries), host);
  }
});

test("refuses a foreign or malformed Host before any route runs", async () => {
  for (const host of ["evil.example", `evil.example:${port}`, "127.0.0.1", "localhost", `127.0.0.1:${port + 1}`]) {
    const reply = await request(BROWSE, { host });
    assert.equal(reply.status, 403, host);
    assert.equal(JSON.parse(reply.body).entries, undefined, host);
  }
  // Node's HTTP parser answers 400 to an HTTP/1.1 request with no Host before the app sees it.
  const missing = await request(BROWSE, { host: null });
  assert.ok(missing.status === 400 || missing.status === 403, String(missing.status));
  assert.ok(!missing.body.includes("entries"));
});

test("answers the app's own origin, through every loopback name", async () => {
  for (const origin of [`http://localhost:${APP_PORT}`, `http://127.0.0.1:${APP_PORT}`, `http://[::1]:${APP_PORT}`]) {
    const reply = await request(BROWSE, { headers: { Origin: origin } });
    assert.equal(reply.status, 200, origin);
  }
});

test("refuses any other origin, including other local ports and null", async () => {
  for (const origin of [
    "https://evil.example",
    "http://localhost:8080",
    `https://localhost:${APP_PORT}`,
    `http://localhost:${port}`,
    "null",
  ]) {
    const reply = await request(BROWSE, { headers: { Origin: origin } });
    assert.equal(reply.status, 403, origin);
    assertNoCorsGrant(reply);
  }
});

test("refuses cross-site and same-site requests that carry no Origin", async () => {
  for (const site of ["cross-site", "same-site"]) {
    const reply = await request(BROWSE, { headers: { "Sec-Fetch-Site": site } });
    assert.equal(reply.status, 403, site);
  }
  for (const site of ["same-origin", "none"]) {
    const reply = await request(BROWSE, { headers: { "Sec-Fetch-Site": site } });
    assert.equal(reply.status, 200, site);
  }
});

test("the app's POST refresh with its own Origin is answered", async () => {
  // Resync is the one request the app sends with an Origin header (a same-origin POST).
  const reply = await request("/api/openspec/resync", {
    method: "POST",
    headers: { Origin: `http://localhost:${APP_PORT}`, "Sec-Fetch-Site": "same-origin" },
  });
  assert.notEqual(reply.status, 403);
});

test("grants no cross-origin access, on a normal response or a preflight", async () => {
  assertNoCorsGrant(await request(BROWSE));
  assertNoCorsGrant(
    await request(BROWSE, {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" },
    }),
  );
  assertNoCorsGrant(
    await request(BROWSE, {
      method: "OPTIONS",
      headers: { Origin: `http://localhost:${APP_PORT}`, "Access-Control-Request-Method": "GET" },
    }),
  );
});
