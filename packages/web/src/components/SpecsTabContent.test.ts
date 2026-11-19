import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SpecsTabContent } from "./SpecsTabContent";

const BASE = "## Requirements\n\n### Requirement: R\n\nR SHALL hold.\n\n#### Scenario: A\n\n- a\n";
const DELTA = "## MODIFIED Requirements\n\n### Requirement: R\n\nR SHALL hold.\n\n#### Scenario: A\n\n- a\n\n#### Scenario: B\n\n- b\n";

const render = (status: "active" | "archived", base: string | null) =>
  renderToStaticMarkup(createElement(SpecsTabContent, { specs: [{ topic: "search", content: DELTA, base }], status }));

const NOTE = /shown for active changes only/;
const pillTexts = (html: string) => [...html.matchAll(/<span class="ml-2[^"]*">([^<]*)<\/span>/g)].map((m) => m[1]);

test("an active change is compared with its base", () => {
  const html = render("active", BASE);
  assert.deepEqual(pillTexts(html), ["new"]);
  assert.doesNotMatch(html, NOTE);
});

test("an active change whose topic has no main spec marks its modified requirements", () => {
  assert.deepEqual(pillTexts(render("active", null)), ["not in current spec"]);
});

test("an archived change shows the note and no marks, even when the server sent a base", () => {
  for (const base of [null, BASE]) {
    const html = render("archived", base);
    assert.match(html, NOTE);
    assert.deepEqual(pillTexts(html), []);
  }
});

test("an archived change without modified requirements shows no note", () => {
  const html = renderToStaticMarkup(
    createElement(SpecsTabContent, { specs: [{ topic: "x", content: "## ADDED Requirements\n\n### Requirement: N\n" }], status: "archived" }),
  );
  assert.doesNotMatch(html, NOTE);
});
