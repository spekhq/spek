import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOrderFromStatus, resolveSchemaOrder, type SchemaArtifactRef } from "./schema-order.js";

// 模擬 `openspec status --change <slug> --json` 的輸出
function statusJson(order: string[], paths: Record<string, string>): unknown {
  return {
    actionContext: { planningArtifacts: order },
    artifactPaths: Object.fromEntries(
      Object.entries(paths).map(([id, outputPath]) => [id, { outputPath }]),
    ),
  };
}

test("parseOrderFromStatus: extracts ordered id/outputPath pairs", () => {
  const refs = parseOrderFromStatus(
    statusJson(
      ["brainstorm", "proposal", "specs", "plan"],
      {
        brainstorm: "brainstorm.md",
        proposal: "proposal.md",
        specs: "specs/**/*.md",
        plan: "plan.md",
      },
    ),
  );
  assert.deepEqual(refs, [
    { id: "brainstorm", outputPath: "brainstorm.md" },
    { id: "proposal", outputPath: "proposal.md" },
    { id: "specs", outputPath: "specs/**/*.md" },
    { id: "plan", outputPath: "plan.md" },
  ]);
});

test("parseOrderFromStatus: preserves planningArtifacts order exactly", () => {
  const refs = parseOrderFromStatus(
    statusJson(["tasks", "proposal"], { proposal: "proposal.md", tasks: "tasks.md" }),
  );
  assert.deepEqual(refs!.map((r) => r.id), ["tasks", "proposal"]);
});

test("parseOrderFromStatus: skips ids that have no outputPath", () => {
  const refs = parseOrderFromStatus(
    statusJson(["proposal", "ghost"], { proposal: "proposal.md" }),
  );
  assert.deepEqual(refs, [{ id: "proposal", outputPath: "proposal.md" }]);
});

test("parseOrderFromStatus: non-string ids are ignored", () => {
  const refs = parseOrderFromStatus({
    actionContext: { planningArtifacts: ["proposal", 42, null] },
    artifactPaths: { proposal: { outputPath: "proposal.md" } },
  });
  assert.deepEqual(refs, [{ id: "proposal", outputPath: "proposal.md" }]);
});

test("parseOrderFromStatus: a numeric id is rejected even if its string form is a path key", () => {
  const refs = parseOrderFromStatus({
    actionContext: { planningArtifacts: [42] },
    artifactPaths: { "42": { outputPath: "foo.md" } },
  });
  assert.equal(refs, null);
});

test("parseOrderFromStatus: non-string outputPath is skipped", () => {
  const refs = parseOrderFromStatus({
    actionContext: { planningArtifacts: ["proposal"] },
    artifactPaths: { proposal: { outputPath: 123 } },
  });
  assert.equal(refs, null);
});

test("parseOrderFromStatus: returns null when nothing resolves", () => {
  assert.equal(parseOrderFromStatus(statusJson([], {})), null);
  assert.equal(parseOrderFromStatus(statusJson(["x"], {})), null);
});

test("parseOrderFromStatus: returns null for malformed shapes", () => {
  assert.equal(parseOrderFromStatus(null), null);
  assert.equal(parseOrderFromStatus(undefined), null);
  assert.equal(parseOrderFromStatus("nope"), null);
  assert.equal(parseOrderFromStatus(42), null);
  assert.equal(parseOrderFromStatus({}), null);
  assert.equal(parseOrderFromStatus({ actionContext: { planningArtifacts: "x" }, artifactPaths: {} }), null);
  assert.equal(parseOrderFromStatus({ actionContext: { planningArtifacts: ["a"] } }), null);
});

// --- resolveSchemaOrder ---

function refs(...pairs: [string, string][]): SchemaArtifactRef[] {
  return pairs.map(([id, outputPath]) => ({ id, outputPath }));
}

test("resolveSchemaOrder: maps literal filenames to ids, preserving order", () => {
  const order = resolveSchemaOrder(
    refs(["brainstorm", "brainstorm.md"], ["proposal", "proposal.md"], ["plan", "plan.md"]),
    ["proposal", "plan", "brainstorm"],
  );
  assert.deepEqual(order, ["brainstorm", "proposal", "plan"]);
});

test("resolveSchemaOrder: specs glob maps to the specs artifact", () => {
  const order = resolveSchemaOrder(
    refs(["specs", "specs/**/*.md"], ["proposal", "proposal.md"]),
    ["proposal", "specs"],
  );
  assert.deepEqual(order, ["specs", "proposal"]);
});

test("resolveSchemaOrder: literal specs/<topic>/spec.md maps to the specs artifact", () => {
  const order = resolveSchemaOrder(refs(["specs", "specs/foo/spec.md"]), ["specs"]);
  assert.deepEqual(order, ["specs"]);
});

test("resolveSchemaOrder: a non-specs glob does not map", () => {
  const order = resolveSchemaOrder(refs(["anything", "*.md"]), ["proposal", "specs"]);
  assert.equal(order, null);
});

test("resolveSchemaOrder: a spec.md literal NOT under a specs path does not map", () => {
  const order = resolveSchemaOrder(refs(["weird", "docs/spec.md"]), ["specs"]);
  assert.equal(order, null);
});

test("resolveSchemaOrder: outputPath is trimmed before matching", () => {
  const order = resolveSchemaOrder(refs(["design", "  design.md  "]), ["design"]);
  assert.deepEqual(order, ["design"]);
});

test("resolveSchemaOrder: refs pointing at unknown ids are skipped", () => {
  const order = resolveSchemaOrder(
    refs(["ghost", "ghost.md"], ["proposal", "proposal.md"]),
    ["proposal"],
  );
  assert.deepEqual(order, ["proposal"]);
});

test("resolveSchemaOrder: two refs mapping to the same id do not duplicate it", () => {
  const order = resolveSchemaOrder(
    refs(["specs", "specs/**/*.md"], ["specs-again", "specs/foo/spec.md"]),
    ["specs"],
  );
  assert.deepEqual(order, ["specs"]);
});

test("resolveSchemaOrder: null refs yields null", () => {
  assert.equal(resolveSchemaOrder(null, ["proposal"]), null);
});

test("resolveSchemaOrder: no matches yields null", () => {
  assert.equal(resolveSchemaOrder(refs(["ghost", "ghost.md"]), ["proposal"]), null);
});
