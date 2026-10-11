import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { SearchResult } from "@spekjs/core";
import { SpecsTabContent } from "./SpecsTabContent";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { resultPath } from "./SearchDialog";

const DELTA = "## ADDED Requirements\n\n### Requirement: Stream results\n\nThe system SHALL stream.\n";

test("nested delta specs keep distinct full-topic headers and anchors", () => {
  const html = renderToStaticMarkup(
    createElement(SpecsTabContent, {
      specs: [
        { topic: "contracts/pagination", content: DELTA },
        { topic: "contracts/pagination/streaming-search", content: DELTA },
      ],
    }),
  );
  assert.match(html, /<h2[^>]*>contracts\/pagination<\/h2>/);
  assert.match(html, /<h2[^>]*>contracts\/pagination\/streaming-search<\/h2>/);
  // ChangeDetail's TOC links each heading as `${topic}--${slug}`; both anchors must exist, apart.
  assert.match(html, /id="contracts\/pagination--requirement-stream-results"/);
  assert.match(html, /id="contracts\/pagination\/streaming-search--requirement-stream-results"/);
});

const renderProposal = (content: string, specTopics: string[]): string =>
  renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(MarkdownRenderer, { content, specTopics })),
  );

test("a full capability id in proposal text links to that nested spec", () => {
  const html = renderProposal("Adds `contracts/pagination/streaming-search`.", [
    "contracts/pagination/streaming-search",
  ]);
  assert.match(html, /href="\/specs\/contracts\/pagination\/streaming-search"/);
});

test("a bare basename does not link to a nested spec", () => {
  const html = renderProposal("Adds `streaming-search`.", ["contracts/pagination/streaming-search"]);
  assert.ok(!html.includes("href="), html);
});

test("a spec search result opens its own full topic", () => {
  const result = (topic: string): SearchResult => ({ type: "spec", title: topic, topic, context: "" });
  assert.equal(resultPath(result("contracts/pagination")), "/specs/contracts/pagination");
  assert.equal(resultPath(result("guides/pagination")), "/specs/guides/pagination");
});
