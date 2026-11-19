import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { foldOptionsFor } from "../hooks/useSpecFold";
import { compareModified } from "../utils/deltaCompare";

const BASE = `## Requirements

### Requirement: Cache **at most once**

The system SHALL cache.

#### Scenario: Hit

- **WHEN** hit

#### Scenario: duplicate \\_id

- **WHEN** dup

#### Scenario: ADDED keys SHALL stay

- **WHEN** kept

### Requirement: Other

Other SHALL hold.

#### Scenario: O

- **WHEN** o
`;

const DELTA = `## ADDED Requirements

### Requirement: Brand new

#### Scenario: Fresh

- **WHEN** fresh

## MODIFIED Requirements

### Requirement: Cache **at most once**

The system SHALL cache.

#### Scenario: Hit

- **WHEN** hit, reworded

#### Scenario: duplicate \\_id

- **WHEN** dup

#### Scenario: Miss

- **WHEN** miss

### Requirement: Other

Other SHALL hold.

#### Scenario: O

- **WHEN** o

### Requirement: Gone missing

#### Scenario: Z

- **WHEN** z
`;

const render = (fold?: ReturnType<typeof foldOptionsFor>) =>
  renderToStaticMarkup(
    createElement(MarkdownRenderer, { content: DELTA, specShaped: true, fold, deltaMarks: compareModified(DELTA, BASE) }),
  );

/** The pills inside each heading, by the heading's own text. */
function pills(html: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of html.matchAll(/<(h[34])[^>]*>(.*?)<\/\1>/g)) {
    const inner = m[2];
    const label = inner.replace(/<span class="ml-2[^"]*">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "").trim();
    out[label] = [...inner.matchAll(/<span class="ml-2[^"]*">([^<]*)<\/span>/g)].map((p) => p[1]);
  }
  return out;
}

test("each heading carries its mark, including names written with markup", () => {
  assert.deepEqual(pills(render()), {
    "Brand new": [],
    Fresh: [],
    "Cache at most once": [],
    Hit: ["changed"],
    "duplicate _id": [],
    Miss: ["new"],
    Other: ["same as current spec"],
    O: [],
    "Gone missing": ["not in current spec"],
    Z: [],
  });
});

test("the dropped list sits right after its requirement, its names as code with no keyword highlighting", () => {
  const html = render();
  const dropped = html.match(/<div class="mb-3 text-sm text-text-muted" data-spek-dropped="">(.*?)<\/div>/);
  assert.ok(dropped, html);
  assert.match(dropped[1], /<code[^>]*>ADDED keys SHALL stay<\/code>/);
  assert.doesNotMatch(dropped[1], /text-badge-added|text-kw-/);
  assert.match(dropped[1], /refuses to archive/);
  // Directly under the requirement heading, before the statement.
  assert.match(html, /Cache <strong[^>]*>at most once<\/strong><\/h3><div class="mb-3 text-sm text-text-muted" data-spek-dropped="">/);
});

test("folded, a scenario's mark stays in its summary and the dropped list in its requirement's body", () => {
  const html = render(foldOptionsFor("default"));
  assert.match(html, /<summary[^>]*>(?:(?!<\/summary>).)*<h4[^>]*>Miss<span class="ml-2[^"]*">new<\/span><\/h4><\/span><\/summary>/s);
  const requirement = html.match(/<h3[^>]*>Cache .*?<\/h3><\/span><\/summary>(.*?)<details/s);
  assert.ok(requirement, html);
  assert.match(requirement[1], /data-spek-dropped/);
});

test("marks change no heading id", () => {
  const withMarks = render();
  const without = renderToStaticMarkup(createElement(MarkdownRenderer, { content: DELTA, specShaped: true }));
  const ids = (html: string) => [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids(withMarks), ids(without));
  assert.doesNotMatch(without, /ml-2 px-1\.5|data-spek-dropped/);
});
