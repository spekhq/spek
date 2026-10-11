import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GraphNode } from "@spekjs/core";
import { specNodeTopic } from "@spekjs/core/graph-node-id";
import { nodeDisplayLabel } from "../nodeText.js";

const spec = (topic: string): GraphNode => ({ id: `spec:${topic}`, type: "spec", label: topic });

test("a nested spec node shows its final segment", () => {
  assert.equal(nodeDisplayLabel(spec("contracts/pagination/streaming-search")), "streaming-search");
  assert.equal(nodeDisplayLabel(spec("auth")), "auth");
  assert.equal(
    nodeDisplayLabel({ id: "change:add-x", type: "change", label: "add x" }),
    "add x",
  );
});

test("a consumer's own spec label is shown, not rebuilt from the id", () => {
  assert.equal(nodeDisplayLabel({ id: "spec:auth", type: "spec", label: "Authentication" }), "Authentication");
});

test("two same-named nodes share a label but each reports its own topic", () => {
  const a = spec("contracts/streaming-search");
  const b = spec("guides/streaming-search");
  assert.equal(nodeDisplayLabel(a), nodeDisplayLabel(b));
  assert.deepEqual([specNodeTopic(a), specNodeTopic(b)], ["contracts/streaming-search", "guides/streaming-search"]);
});

// The click and the tooltip run inside d3 handlers, and this suite has no DOM; what it can hold is that
// both read the node's identity rather than its displayed label.
const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "SpecGraph.tsx"), "utf-8");

test("a spec click reports the topic from the node id", () => {
  assert.match(src, /onSelectSpecRef\.current\?\.\(specNodeTopic\(d\)\)/);
  assert.ok(!/onSelectSpecRef\.current\?\.\(d\.label\)/.test(src), "a spec click must not report the label");
});

test("a spec node's tooltip is its full topic", () => {
  assert.match(
    src,
    /\.filter\(\(d\) => d\.type === "spec"\)\s*\.append\("title"\)\s*\.text\(\(d\) => specNodeTopic\(d\)\)/,
  );
});
