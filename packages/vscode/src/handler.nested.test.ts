import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";

// The handler is the VS Code host's whole data surface, and it imports `vscode`, which exists only
// inside the extension host. The one API it touches here is the settings read; aggregation is reported
// off so the fixture, which sits inside this repository's git checkout, is scanned on its own.
const VSCODE_STUB = {
  workspace: {
    getConfiguration: () => ({ get: (key: string, fallback: unknown) => (key === "aggregateWorktrees" ? false : fallback) }),
  },
};
const moduleInternals = Module as unknown as {
  _load: (request: string, ...rest: unknown[]) => unknown;
};
const load = moduleInternals._load;
moduleInternals._load = function (request: string, ...rest: unknown[]) {
  return request === "vscode" ? VSCODE_STUB : load.call(this, request, ...rest);
};

const FIXTURE = path.resolve(__dirname, "../../../test-fixtures/nested-specs");
const EXPECTED = JSON.parse(fs.readFileSync(path.join(FIXTURE, "expected.json"), "utf-8")) as {
  topics: string[];
  edges: [string, string][];
  searchSpecTopics: Record<string, string[]>;
};

async function handler() {
  const { MessageHandler } = await import("./handler");
  return new MessageHandler(FIXTURE);
}

test("the VS Code host lists, reads, versions, searches, and graphs nested topics as core does", async () => {
  const h = await handler();
  const specs = (await h.handle("getSpecs")) as { topic: string }[];
  assert.deepEqual(specs.map((s) => s.topic), EXPECTED.topics);

  const child = (await h.handle("getSpec", { topic: "contracts/pagination/streaming-search" })) as {
    relatedChanges: string[];
  };
  assert.deepEqual(child.relatedChanges, ["add-streaming-search"]);

  const version = (await h.handle("getSpecAtChange", {
    topic: "contracts/pagination/streaming-search",
    slug: "add-streaming-search",
  })) as { content: string };
  assert.match(version.content, /DELTAONLYTERM/);

  for (const [query, topics] of Object.entries(EXPECTED.searchSpecTopics)) {
    const results = (await h.handle("search", { query })) as { type: string; topic?: string }[];
    assert.deepEqual(results.filter((r) => r.type === "spec").map((r) => r.topic), topics, query);
  }

  const graph = (await h.handle("getGraphData")) as { edges: { source: string; target: string }[] };
  assert.deepEqual(graph.edges.map((e) => [e.source, e.target]).sort(), EXPECTED.edges);
});
