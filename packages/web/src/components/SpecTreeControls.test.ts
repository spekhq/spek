import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SpecTreeControls } from "./SpecTreeControls";

const render = (hasFolders: boolean, filtering: boolean): string =>
  renderToStaticMarkup(
    createElement(SpecTreeControls, { hasFolders, filtering, onExpandAll: () => {}, onCollapseAll: () => {} }),
  );

const buttons = (html: string) => [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)];

test("a flat spec list gets no controls", () => {
  assert.equal(render(false, false), "");
});

test("a tree with folders gets Expand all and Collapse all, enabled", () => {
  const found = buttons(render(true, false));
  assert.deepEqual(found.map((m) => m[1]), ["Expand all", "Collapse all"]);
  for (const [button] of found) assert.doesNotMatch(button, /\sdisabled=""/);
});

test("while filtering both stay shown but disabled, and look it", () => {
  const found = buttons(render(true, true));
  assert.equal(found.length, 2);
  for (const [button] of found) {
    assert.match(button, /\sdisabled=""/);
    assert.match(button, /disabled:opacity-50/);
    assert.doesNotMatch(button, /(?<![:\w-])hover:/, "hover must be scoped to enabled:");
  }
});
