import { test } from "node:test";
import assert from "node:assert/strict";
import type { GraphNode, WorktreeSource } from "@spekjs/core";
import { changeNodeSlug } from "../graphNodeId";

function mkSource(key: string): WorktreeSource {
  return { key, path: `/repo/${key}`, branch: "feature", isMain: false, vcs: "git" };
}

function mkChangeNode(id: string, source?: WorktreeSource): GraphNode {
  return { id, type: "change", label: "some description", source };
}

test("changeNodeSlug: non-aggregated id", () => {
  assert.equal(changeNodeSlug(mkChangeNode("change:add-timeline")), "add-timeline");
});

test("changeNodeSlug: aggregated id drops the worktree key", () => {
  const node = mkChangeNode("change:6d80d73a:add-timeline", mkSource("6d80d73a"));
  assert.equal(changeNodeSlug(node), "add-timeline");
});

test("changeNodeSlug: both forms of the same change resolve alike", () => {
  const plain = mkChangeNode("change:add-timeline");
  const aggregated = mkChangeNode("change:6d80d73a:add-timeline", mkSource("6d80d73a"));
  assert.equal(changeNodeSlug(plain), changeNodeSlug(aggregated));
});

// A host may normalise ids itself before handing the graph on (spekterm did, working around the bug
// this helper fixes) while leaving `source` in place. Stripping the key twice must be a no-op, not
// eat the head of the slug.
test("changeNodeSlug: already-normalised id that still carries source is left alone", () => {
  const node = mkChangeNode("change:add-timeline", mkSource("6d80d73a"));
  assert.equal(changeNodeSlug(node), "add-timeline");
});

test("changeNodeSlug: slug containing a colon survives", () => {
  const node = mkChangeNode("change:6d80d73a:odd:slug", mkSource("6d80d73a"));
  assert.equal(changeNodeSlug(node), "odd:slug");
});

test("changeNodeSlug: id without the change prefix is returned unchanged", () => {
  assert.equal(changeNodeSlug(mkChangeNode("spec:auth")), "spec:auth");
});
