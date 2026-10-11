import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { SpecInfo } from "@spekjs/core";
import { SpecTree } from "./SpecTree";

const spec = (topic: string, historyCount = 0): SpecInfo => ({ topic, path: `/r/${topic}/spec.md`, historyCount });

const SPECS = [
  spec("auth"),
  spec("contracts/pagination", 1),
  spec("contracts/pagination/streaming-search", 2),
  spec("guides/pagination"),
];

const render = (filter = "", specs = SPECS): string =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(SpecTree, { specs, filter })));

const links = (html: string): string[] => [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);

test("a spec-bearing parent is a link and expands to its child", () => {
  const html = render();
  assert.ok(links(html).includes("/specs/contracts/pagination"));
  assert.ok(links(html).includes("/specs/contracts/pagination/streaming-search"));
  assert.match(html, /aria-label="Collapse contracts\/pagination"/);
  assert.match(html, /title="contracts\/pagination\/streaming-search"[^>]*>streaming-search</);
});

test("a grouping-only folder links nowhere", () => {
  const html = render();
  assert.ok(!links(html).some((href) => href === "/specs/contracts" || href === "/specs/guides"));
  assert.match(html, /<span title="guides"[^>]*>guides\/<\/span>/);
});

test("duplicate basenames stay distinct by full topic", () => {
  const html = render();
  assert.match(html, /<a title="contracts\/pagination"[^>]*href="\/specs\/contracts\/pagination"[^>]*>pagination</);
  assert.match(html, /<a title="guides\/pagination"[^>]*href="\/specs\/guides\/pagination"[^>]*>pagination</);
});

test("filtering matches the full topic and keeps the folders above a match", () => {
  assert.deepEqual(links(render("guides/pag")), ["/specs/guides/pagination"]);
  // The parent did not match on its own but stays openable as the way to its matching child.
  assert.deepEqual(links(render("STREAMING")), [
    "/specs/contracts/pagination",
    "/specs/contracts/pagination/streaming-search",
  ]);
  assert.match(render("nothing-matches"), /No specs found/);
});

test("siblings order per segment by code unit", () => {
  const html = render("", [spec("ab"), spec("a/c"), spec("a-b"), spec("a")]);
  assert.deepEqual(links(html), ["/specs/a", "/specs/a/c", "/specs/a-b", "/specs/ab"]);
});

test("history counts remain on spec items", () => {
  assert.match(render(), />2 changes</);
  assert.match(render(), />1 change</);
});

test("while filtering, the toggles are inert, so no collapse is recorded to surface later", () => {
  const toggles = (html: string) => [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  assert.ok(toggles(render("pag")).length > 0);
  for (const button of toggles(render("pag"))) assert.match(button, /\sdisabled=""/);
  for (const button of toggles(render())) assert.doesNotMatch(button, /\sdisabled/);
});
