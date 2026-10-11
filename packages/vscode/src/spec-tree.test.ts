import { test } from "node:test";
import assert from "node:assert/strict";
import type { Heading, SpecInfo } from "@spekjs/core";
import { buildSpecTree } from "@spekjs/core/spec-topic";
import { headingRoute, specFolderChildren } from "./spec-tree";

const spec = (topic: string): SpecInfo => ({ topic, path: `/r/${topic}/spec.md`, historyCount: 0 });
const HEADINGS: Heading[] = [
  { level: 2, text: "Requirements", slug: "requirements" },
  { level: 3, text: "Requirement: Stream", slug: "requirement-stream" },
];

const roots = buildSpecTree([
  spec("contracts/pagination/streaming-search"),
  spec("contracts/pagination"),
  spec("auth"),
]);

test("roots are the top-level folders, ordered per segment", () => {
  assert.deepEqual(roots.map((n) => [n.name, n.spec !== null]), [["auth", true], ["contracts", false]]);
});

test("a spec-bearing parent lists child topics before its own headings", () => {
  const pagination = roots[1].children[0];
  const rows = specFolderChildren(pagination, HEADINGS).map((c) =>
    c.kind === "folder" ? `folder:${c.node.path}` : `heading:${c.heading.slug}`,
  );
  assert.deepEqual(rows, [
    "folder:contracts/pagination/streaming-search",
    "heading:requirements",
    "heading:requirement-stream",
  ]);
});

test("a grouping-only folder lists no headings", () => {
  assert.deepEqual(
    specFolderChildren(roots[1], HEADINGS).map((c) => c.kind),
    ["folder"],
  );
});

test("a heading routes to its full topic with the heading hash", () => {
  const child = specFolderChildren(roots[1].children[0].children[0], HEADINGS)[1];
  assert.equal(child.kind, "heading");
  if (child.kind !== "heading") return;
  assert.equal(
    headingRoute(child.topic, child.heading),
    "/specs/contracts/pagination/streaming-search#requirement-stream",
  );
});
