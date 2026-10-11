import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGraphData,
  readChange,
  readSpec,
  readSpecAtChange,
  scanOpenSpec,
  type ChangeDetail,
  type SpecDetail,
} from "@spekjs/core";
import { StaticAdapter, type DemoData } from "./StaticAdapter.js";

const FIXTURE = fileURLToPath(new URL("../../../../test-fixtures/nested-specs", import.meta.url));
const EXPECTED = JSON.parse(readFileSync(path.join(FIXTURE, "expected.json"), "utf-8")) as {
  topics: string[];
  edges: [string, string][];
  searchSpecTopics: Record<string, string[]>;
};

// The payload is collected the way scripts/build-demo.ts collects it, from the shared fixture.
async function fixturePayload(): Promise<Partial<DemoData>> {
  const scan = await scanOpenSpec(FIXTURE);
  const specDetails: Record<string, SpecDetail> = {};
  const specVersions: Record<string, Record<string, string>> = {};
  for (const spec of scan.specs) {
    const detail = await readSpec(FIXTURE, spec.topic);
    if (!detail) continue;
    specDetails[spec.topic] = detail;
    for (const entry of detail.history) {
      const version = readSpecAtChange(FIXTURE, spec.topic, entry.slug);
      if (version) (specVersions[spec.topic] ??= {})[entry.slug] = version.content;
    }
  }
  const changeDetails: Record<string, ChangeDetail> = {};
  for (const change of [...scan.activeChanges, ...scan.archivedChanges]) {
    const detail = await readChange(FIXTURE, change.slug, async () => null);
    if (detail) changeDetails[change.slug] = detail;
  }
  return { specs: scan.specs, specDetails, specVersions, changeDetails, graphData: buildGraphData(FIXTURE) };
}

test("the static build serves the shared nested answers: topics, versions, search, graph", async () => {
  (globalThis as unknown as Record<string, unknown>).window = { __DEMO_DATA__: await fixturePayload() };
  const adapter = new StaticAdapter();
  assert.deepEqual((await adapter.getSpecs()).map((s) => s.topic), EXPECTED.topics);
  assert.deepEqual((await adapter.getSpec("contracts/pagination")).relatedChanges, ["2026-01-10-add-pagination"]);
  assert.match(
    (await adapter.getSpecAtChange("contracts/pagination/streaming-search", "add-streaming-search")).content,
    /DELTAONLYTERM/,
  );
  await assert.rejects(adapter.getSpecAtChange("contracts/pagination", "add-streaming-search"));
  for (const [query, topics] of Object.entries(EXPECTED.searchSpecTopics)) {
    const results = await adapter.search(query);
    assert.deepEqual(results.filter((r) => r.type === "spec").map((r) => r.topic), topics, query);
  }
  // A term only in a nested delta is in no document the static build indexes either.
  assert.deepEqual(await adapter.search("DELTAONLYTERM"), []);
  const graph = await adapter.getGraphData();
  assert.deepEqual(graph.edges.map((e) => [e.source, e.target]).sort(), EXPECTED.edges);
});
