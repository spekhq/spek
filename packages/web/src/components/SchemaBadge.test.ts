import { test } from "node:test";
import assert from "node:assert/strict";
import { SchemaBadge, SchemaPill } from "./SchemaBadge";

// 直接以函式呼叫 component 檢查其 render 決策（隱藏 → null、顯示 → 一個 SchemaPill element），
// 不需 DOM，對齊 repo 既有的純邏輯測試風格。
test("SchemaBadge: renders nothing when schema is falsy", () => {
  assert.equal(SchemaBadge({ schema: null, defaultSchema: "spec-driven" }), null);
  assert.equal(SchemaBadge({ schema: undefined, defaultSchema: "spec-driven" }), null);
  assert.equal(SchemaBadge({ schema: "", defaultSchema: "spec-driven" }), null);
});

test("SchemaBadge: renders nothing when schema equals the repo default", () => {
  assert.equal(SchemaBadge({ schema: "spec-driven", defaultSchema: "spec-driven" }), null);
  assert.equal(SchemaBadge({ schema: "agent-driven", defaultSchema: "agent-driven" }), null);
});

test("SchemaBadge: renders a pill when schema differs from the repo default", () => {
  const el = SchemaBadge({ schema: "superpowers-bridge", defaultSchema: "spec-driven" });
  assert.ok(el, "expected a SchemaPill element");
  assert.equal(el.type, SchemaPill);
  assert.equal(el.props.schema, "superpowers-bridge");
});

test("SchemaBadge: renders a non-default pill even when the repo default is not spec-driven", () => {
  const el = SchemaBadge({ schema: "spec-driven", defaultSchema: "agent-driven" });
  assert.ok(el, "expected a SchemaPill element");
  assert.equal(el.props.schema, "spec-driven");
});

test("SchemaBadge: renders when no repo default is known but the change has a schema", () => {
  const el = SchemaBadge({ schema: "spec-driven", defaultSchema: null });
  assert.ok(el, "expected a SchemaPill element");
  assert.equal(el.props.schema, "spec-driven");
});

// SchemaPill 沒有隱藏邏輯：一律顯示傳入的 schema（供 specs 頁的 repo 預設 schema 標示使用）。
test("SchemaPill: always renders the given schema name", () => {
  const el = SchemaPill({ schema: "spec-driven" });
  assert.ok(el);
  assert.equal(el.props.children, "spec-driven");
});

test("SchemaPill: uses the provided title when given", () => {
  const el = SchemaPill({ schema: "spec-driven", title: "Repo default OpenSpec schema" });
  assert.equal(el.props.title, "Repo default OpenSpec schema");
});
