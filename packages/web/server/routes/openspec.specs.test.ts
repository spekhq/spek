import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { openspecRouter } from "./openspec.js";
import { FetchAdapter } from "../../src/api/FetchAdapter.js";

// The shared nested corpus, also read by core's and the Kotlin tests.
const FIXTURE = fileURLToPath(new URL("../../../../test-fixtures/nested-specs", import.meta.url));

let server: Server;
let base: string;

before(async () => {
  const app = express();
  app.use("/api/openspec", openspecRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// `rest` is appended verbatim, so a test controls the exact encoding the server receives.
function get(path: string, rest = ""): Promise<Response> {
  const sep = path.includes("?") ? "&" : "?";
  return fetch(`${base}/api/openspec${path}${sep}dir=${encodeURIComponent(FIXTURE)}${rest}`);
}

test("the list returns every nested topic as its own entry", async () => {
  const res = await get("/specs");
  assert.equal(res.status, 200);
  const topics = ((await res.json()) as { topic: string }[]).map((s) => s.topic);
  assert.ok(topics.includes("contracts/pagination"));
  assert.ok(topics.includes("contracts/pagination/streaming-search"));
});

test("topic selects nested detail, with exact-path history", async () => {
  const res = await get("/specs", "&topic=contracts%2Fpagination");
  assert.equal(res.status, 200);
  const body = (await res.json()) as { topic: string; relatedChanges: string[] };
  assert.equal(body.topic, "contracts/pagination");
  assert.deepEqual(body.relatedChanges, ["2026-01-10-add-pagination"]);
});

test("topic + at selects nested version content", async () => {
  const res = await get("/specs", "&topic=contracts%2Fpagination%2Fstreaming-search&at=add-streaming-search");
  assert.equal(res.status, 200);
  assert.match(((await res.json()) as { content: string }).content, /DELTAONLYTERM/);
});

test("malformed selectors are 400", async () => {
  for (const rest of [
    "&topic=..%2Fsecrets",
    "&topic=contracts%2F%2Fpagination",
    "&topic=%2Fabs",
    "&topic=auth%0A",
    "&topic=auth%2F",
    "&topic=.drafts%2Fhidden",
    "&topic=auth&topic=auth",
    "&at=add-streaming-search",
    "&topic=auth&at=a%2Fb",
    "&topic=auth&at=..",
  ]) {
    const res = await get("/specs", rest);
    assert.equal(res.status, 400, rest);
  }
});

test("well-formed but absent content is 404", async () => {
  assert.equal((await get("/specs", "&topic=nope")).status, 404);
  assert.equal((await get("/specs", "&topic=contracts")).status, 404);
  // A parent's delta is not a version of its child.
  assert.equal((await get("/specs", "&topic=contracts%2Fpagination&at=add-streaming-search")).status, 404);
  assert.equal((await get("/specs", "&topic=auth&at=no-such-change")).status, 404);
});

test("the flat routes keep working and apply the same validation", async () => {
  const flat = await get("/specs/auth");
  assert.equal(flat.status, 200);
  assert.equal(((await flat.json()) as { topic: string }).topic, "auth");
  assert.equal((await get("/specs/auth/at/add-streaming-search")).status, 404);
  assert.equal((await get("/specs/..%2F..%2Fsecret")).status, 400);
  assert.equal((await get("/specs/auth/at/..%2Fx")).status, 400);
});

test("FetchAdapter reaches nested detail and versions through the query selectors", async () => {
  const adapter = new FetchAdapter(FIXTURE, { baseUrl: `${base}/api` });
  assert.equal((await adapter.getSpec("contracts/pagination/streaming-search")).topic, "contracts/pagination/streaming-search");
  assert.match(
    (await adapter.getSpecAtChange("contracts/pagination/streaming-search", "add-streaming-search")).content,
    /DELTAONLYTERM/,
  );
  assert.equal((await adapter.getSpec("auth")).topic, "auth");
});

// The cross-surface contract: the same answers expected.json holds every host to.
const EXPECTED = JSON.parse(readFileSync(path.join(FIXTURE, "expected.json"), "utf-8")) as {
  topics: string[];
  edges: [string, string][];
  searchSpecTopics: Record<string, string[]>;
};

test("the web host serves the shared nested answers: topics, search, history, graph", async () => {
  const adapter = new FetchAdapter(FIXTURE, { baseUrl: `${base}/api` });
  assert.deepEqual((await adapter.getSpecs()).map((s) => s.topic), EXPECTED.topics);
  for (const [query, topics] of Object.entries(EXPECTED.searchSpecTopics)) {
    const results = await adapter.search(query);
    assert.deepEqual(results.filter((r) => r.type === "spec").map((r) => r.topic), topics, query);
  }
  assert.deepEqual((await adapter.getSpec("guides/pagination")).relatedChanges, ["2026-02-01-add-guides"]);
  // Aggregation off: the fixture sits inside this repository's checkout, whose worktrees are not its own.
  const graph = await adapter.getGraphData(false);
  assert.deepEqual(graph.edges.map((e) => [e.source, e.target]).sort(), EXPECTED.edges);
});
