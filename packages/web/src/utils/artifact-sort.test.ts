import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChangeArtifact } from "@spek/core";
import { sortArtifacts } from "./artifact-sort.js";

function art(id: string, title?: string): ChangeArtifact {
  return { id, title: title ?? id, kind: "markdown", content: "" };
}

const ids = (arts: ChangeArtifact[]) => arts.map((a) => a.id);

test("modified: returns artifacts in the delivered order", () => {
  const arts = [art("tasks"), art("design"), art("proposal")];
  assert.deepEqual(ids(sortArtifacts(arts, "modified")), ["tasks", "design", "proposal"]);
});

test("modified: does not mutate or reorder", () => {
  const arts = [art("tasks"), art("proposal")];
  const out = sortArtifacts(arts, "modified");
  assert.equal(out, arts); // same reference, no copy needed
});

test("alpha: sorts by display title A–Z (not by id or default order)", () => {
  // ids are deliberately ordered opposite to titles, so passing this REQUIRES sorting by
  // title — id order or the default narrative order would produce a different result.
  const arts = [art("c", "Apple"), art("a", "Mango"), art("b", "Zebra")];
  assert.deepEqual(ids(sortArtifacts(arts, "alpha")), ["c", "a", "b"]);
});

test("alpha: equal titles break the tie deterministically by id", () => {
  // two files that humanize to the same display title must sort the same regardless of
  // input order — i.e. not depend on engine sort stability. The id tiebreak guarantees this.
  const a = art("my-plan", "My Plan");
  const b = art("my_plan", "My Plan");
  const forward = ids(sortArtifacts([a, b], "alpha"));
  const reversed = ids(sortArtifacts([b, a], "alpha"));
  assert.deepEqual(forward, reversed);
});

test("schema: orders by schemaOrder", () => {
  const arts = [art("proposal"), art("brainstorm"), art("plan")];
  const out = sortArtifacts(arts, "schema", ["brainstorm", "proposal", "plan"]);
  assert.deepEqual(ids(out), ["brainstorm", "proposal", "plan"]);
});

test("schema: artifacts absent from schemaOrder are appended in default narrative order", () => {
  // `apple` sorts before `design` alphabetically, but `design` outranks it in the default
  // narrative order — so this only passes if DEFAULT_ORDER (not plain alpha) breaks the tie.
  const arts = [art("tasks"), art("apple"), art("proposal"), art("design")];
  const out = sortArtifacts(arts, "schema", ["proposal", "tasks"]);
  // matched first (proposal, tasks), then unmatched by DEFAULT_ORDER: design (ranked) before apple (alpha)
  assert.deepEqual(ids(out), ["proposal", "tasks", "design", "apple"]);
});

test("schema: null schemaOrder falls back to default narrative order", () => {
  const arts = [art("zebra"), art("tasks"), art("apple"), art("proposal"), art("specs", "Specs")];
  const out = sortArtifacts(arts, "schema", undefined);
  assert.deepEqual(ids(out), ["proposal", "specs", "tasks", "apple", "zebra"]);
});

test("schema: empty schemaOrder falls back to default narrative order", () => {
  const arts = [art("tasks"), art("proposal")];
  const out = sortArtifacts(arts, "schema", []);
  assert.deepEqual(ids(out), ["proposal", "tasks"]);
});

test("schema: does not mutate the input array", () => {
  const arts = [art("tasks"), art("proposal")];
  const snapshot = ids(arts);
  sortArtifacts(arts, "schema", ["proposal", "tasks"]);
  assert.deepEqual(ids(arts), snapshot);
});
