import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildSpecTree,
  isSafeChangeSlug,
  isSafeSpecTopic,
  pruneSpecTree,
  specRoute,
  specTopicLabel,
  type SpecTreeNode,
} from "./spec-topic.js";

test("well-formed topics are accepted, flat and nested", () => {
  for (const topic of ["auth", "contracts/pagination", "contracts/pagination/streaming-search", "a b", "x.y"]) {
    assert.ok(isSafeSpecTopic(topic), topic);
  }
});

test("escaping, empty, dotted, and control-character topics are refused", () => {
  for (const topic of [
    "",
    "../secrets",
    "contracts/../auth",
    "contracts//pagination",
    "/abs",
    "auth/",
    "C:\\x",
    "a\\b",
    "auth\n",
    "auth\r",
    "au\0th",
    ".",
    "..",
    ".drafts/auth",
    "contracts/.hidden",
  ]) {
    assert.equal(isSafeSpecTopic(topic), false, JSON.stringify(topic));
  }
});

test("a change slug is one safe segment and never the archive directory", () => {
  assert.ok(isSafeChangeSlug("add-auth"));
  assert.ok(isSafeChangeSlug("2026-01-10-add-pagination"));
  for (const slug of ["", "a/b", "a\\b", "..", ".hidden", "archive", "add\n"]) {
    assert.equal(isSafeChangeSlug(slug), false, JSON.stringify(slug));
  }
});

test("the label is the final segment and the route encodes each segment", () => {
  assert.equal(specTopicLabel("contracts/pagination/streaming-search"), "streaming-search");
  assert.equal(specTopicLabel("auth"), "auth");
  assert.equal(specRoute("contracts/pagination"), "/specs/contracts/pagination");
  assert.equal(specRoute("a b/c#d?e%f"), "/specs/a%20b/c%23d%3Fe%25f");
});

const shape = <T>(nodes: SpecTreeNode<T>[]): unknown =>
  nodes.map((n) => [n.name, n.spec !== null, shape(n.children)]);

test("siblings sort per segment by code unit, not by full topic", () => {
  const tree = buildSpecTree([{ topic: "ab" }, { topic: "a/c" }, { topic: "a-b" }, { topic: "a" }]);
  assert.deepEqual(shape(tree), [
    ["a", true, [["c", true, []]]],
    ["a-b", true, []],
    ["ab", true, []],
  ]);
});

test("a spec-bearing parent holds its children; a grouping folder holds no spec", () => {
  const tree = buildSpecTree([
    { topic: "contracts/pagination/streaming-search" },
    { topic: "contracts/pagination" },
    { topic: "guides/pagination" },
  ]);
  assert.deepEqual(shape(tree), [
    ["contracts", false, [["pagination", true, [["streaming-search", true, []]]]]],
    ["guides", false, [["pagination", true, []]]],
  ]);
  assert.equal(tree[0].children[0].children[0].path, "contracts/pagination/streaming-search");
  assert.equal(tree[1].children[0].spec?.topic, "guides/pagination");
});

test("pruning keeps matches and their ancestors, and an ancestor keeps its own spec", () => {
  const tree = buildSpecTree([
    { topic: "contracts/pagination" },
    { topic: "contracts/pagination/streaming-search" },
    { topic: "guides/pagination" },
    { topic: "auth" },
  ]);
  const pruned = pruneSpecTree(tree, (s) => s.topic.includes("streaming"));
  assert.deepEqual(shape(pruned), [["contracts", false, [["pagination", true, [["streaming-search", true, []]]]]]]);
});

test("the subpath stays reachable from a browser bundle", () => {
  const source = readFileSync(fileURLToPath(new URL("./spec-topic.ts", import.meta.url)), "utf-8");
  assert.ok(!/^\s*import\s/m.test(source), "spec-topic.ts must import nothing");
});
