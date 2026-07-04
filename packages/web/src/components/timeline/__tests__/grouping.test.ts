import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChangeInfo, GraphData } from "@spek/core";
import { buildLanes, changeTopicsMap } from "../grouping";

function mkChange(overrides: Partial<ChangeInfo> & { slug: string }): ChangeInfo {
  return {
    slug: overrides.slug,
    date: null,
    timestamp: null,
    createdDate: overrides.createdDate ?? null,
    archivedDate: overrides.archivedDate ?? null,
    description: overrides.description ?? overrides.slug,
    status: overrides.status ?? "active",
    hasProposal: true,
    hasDesign: false,
    hasTasks: true,
    hasSpecs: true,
    artifactCount: overrides.artifactCount ?? 3,
    schema: overrides.schema ?? null,
    taskStats: null,
  };
}

function mkGraph(edges: { change: string; topics: string[] }[]): GraphData {
  const nodes: GraphData["nodes"] = [];
  const seenSpec = new Set<string>();
  const seenChange = new Set<string>();
  const allEdges: GraphData["edges"] = [];
  for (const e of edges) {
    if (!seenChange.has(e.change)) {
      nodes.push({ id: `change:${e.change}`, type: "change", label: `desc-${e.change}` });
      seenChange.add(e.change);
    }
    for (const t of e.topics) {
      if (!seenSpec.has(t)) {
        nodes.push({ id: `spec:${t}`, type: "spec", label: t });
        seenSpec.add(t);
      }
      allEdges.push({ source: `change:${e.change}`, target: `spec:${t}` });
    }
  }
  return { nodes, edges: allEdges };
}

test("buildLanes: empty input → empty lanes, empty unknown", () => {
  const r = buildLanes([], null, false);
  assert.deepEqual(r.lanes, []);
  assert.deepEqual(r.unknownCreated, []);
});

test("buildLanes: single change with createdDate, flat view", () => {
  const c = mkChange({ slug: "foo", createdDate: "2026-01-10" });
  const r = buildLanes([c], null, false);
  assert.equal(r.lanes.length, 1);
  assert.equal(r.lanes[0].topic, null);
  assert.equal(r.lanes[0].items.length, 1);
  assert.equal(r.lanes[0].items[0].change.slug, "foo");
  assert.deepEqual(r.lanes[0].items[0].topics, []);
  assert.deepEqual(r.unknownCreated, []);
});

test("buildLanes: missing createdDate → unknownCreated, not in lanes", () => {
  const a = mkChange({ slug: "with-date", createdDate: "2026-01-10" });
  const b = mkChange({ slug: "no-date", createdDate: null });
  const r = buildLanes([a, b], null, false);
  assert.equal(r.lanes[0].items.length, 1);
  assert.equal(r.lanes[0].items[0].change.slug, "with-date");
  assert.equal(r.unknownCreated.length, 1);
  assert.equal(r.unknownCreated[0].slug, "no-date");
});

test("buildLanes: all missing createdDate → no lanes", () => {
  const r = buildLanes([mkChange({ slug: "x" }), mkChange({ slug: "y" })], null, false);
  assert.deepEqual(r.lanes, []);
  assert.equal(r.unknownCreated.length, 2);
});

test("buildLanes: deterministic ordering by createdDate ascending then slug", () => {
  const r = buildLanes(
    [
      mkChange({ slug: "c", createdDate: "2026-02-01" }),
      mkChange({ slug: "a", createdDate: "2026-01-15" }),
      mkChange({ slug: "b", createdDate: "2026-01-15" }),
    ],
    null,
    false,
  );
  assert.deepEqual(
    r.lanes[0].items.map((i) => i.change.slug),
    ["a", "b", "c"],
  );
});

test("changeTopicsMap: handles missing graph", () => {
  assert.equal(changeTopicsMap(null).size, 0);
});

test("changeTopicsMap: extracts slug→topics map from graph edges", () => {
  const graph = mkGraph([
    { change: "foo", topics: ["alpha", "beta"] },
    { change: "bar", topics: ["alpha"] },
  ]);
  const map = changeTopicsMap(graph);
  assert.deepEqual(map.get("foo"), ["alpha", "beta"]);
  assert.deepEqual(map.get("bar"), ["alpha"]);
});

test("buildLanes: group by topic, multi-topic change appears in each topic lane", () => {
  const graph = mkGraph([
    { change: "multi", topics: ["alpha", "beta"] },
    { change: "solo", topics: ["alpha"] },
  ]);
  const changes = [
    mkChange({ slug: "multi", createdDate: "2026-01-15" }),
    mkChange({ slug: "solo", createdDate: "2026-01-10" }),
  ];
  const r = buildLanes(changes, graph, true);
  // 兩個 topic lanes (alpha 在前因 sort)
  assert.equal(r.lanes.length, 2);
  const alpha = r.lanes.find((l) => l.topic === "alpha")!;
  const beta = r.lanes.find((l) => l.topic === "beta")!;
  assert.deepEqual(
    alpha.items.map((i) => i.change.slug),
    ["solo", "multi"], // by createdDate asc
  );
  assert.deepEqual(
    beta.items.map((i) => i.change.slug),
    ["multi"],
  );
  // multi 兩處的 topics 欄位都列全 topics
  for (const item of alpha.items) {
    if (item.change.slug === "multi") {
      assert.deepEqual(item.topics, ["alpha", "beta"]);
    }
  }
});

test("buildLanes: group by topic, change with no topic edge → '' topic lane sorted last", () => {
  const graph = mkGraph([{ change: "withTopic", topics: ["alpha"] }]);
  const changes = [
    mkChange({ slug: "withTopic", createdDate: "2026-01-10" }),
    mkChange({ slug: "orphan", createdDate: "2026-01-12" }),
  ];
  const r = buildLanes(changes, graph, true);
  assert.equal(r.lanes.length, 2);
  assert.equal(r.lanes[0].topic, "alpha");
  assert.equal(r.lanes[1].topic, ""); // 無 topic lane 排最後
  assert.equal(r.lanes[1].items[0].change.slug, "orphan");
});

test("buildLanes: groupByTopic=false ignores graph", () => {
  const graph = mkGraph([{ change: "foo", topics: ["alpha", "beta"] }]);
  const changes = [mkChange({ slug: "foo", createdDate: "2026-01-10" })];
  const r = buildLanes(changes, graph, false);
  assert.equal(r.lanes.length, 1);
  assert.equal(r.lanes[0].items.length, 1);
  // 但 topics 欄位仍從 graph 取得（給 tooltip 用）
  assert.deepEqual(r.lanes[0].items[0].topics, ["alpha", "beta"]);
});
