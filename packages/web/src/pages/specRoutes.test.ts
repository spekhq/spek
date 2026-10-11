import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MemoryRouter, Route, Routes, matchRoutes, useLocation, useParams } from "react-router-dom";
import { specRoute } from "@spekjs/core/spec-topic";

const TOPICS = ["user-auth", "contracts/pagination/streaming-search", "a b/c#d?e%f"];

// What SpecDetail reads: the splat is the topic, the hash is the heading.
function Probe() {
  const topic = useParams()["*"];
  const { hash } = useLocation();
  return createElement("output", null, JSON.stringify({ topic, hash }));
}

const renderAt = (url: string): { topic: string; hash: string } => {
  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [url] },
      createElement(Routes, null, createElement(Route, { path: "/specs/*", element: createElement(Probe) })),
    ),
  );
  const json = /<output>(.*)<\/output>/.exec(html)?.[1] ?? "{}";
  return JSON.parse(json.replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
};

test("a spec URL loaded directly resolves back to its full topic", () => {
  // matchRoutes is what a browser router does on a direct load or a refresh of the same URL.
  for (const topic of TOPICS) {
    const match = matchRoutes([{ path: "/specs/*" }], specRoute(topic));
    assert.equal(match?.[0].params["*"], topic, topic);
  }
});

test("in-app navigation keeps the full topic and the heading hash", () => {
  for (const topic of TOPICS) {
    assert.deepEqual(renderAt(`${specRoute(topic)}#requirement-foo`), { topic, hash: "#requirement-foo" });
  }
});

test("a flat spec URL is unchanged", () => {
  assert.equal(specRoute("user-auth"), "/specs/user-auth");
});

test("every entry point routes specs by splat", () => {
  for (const entry of ["App.tsx", "WebviewApp.tsx", "DemoApp.tsx", "IntellijApp.tsx"]) {
    const source = readFileSync(fileURLToPath(new URL(`../${entry}`, import.meta.url)), "utf-8");
    assert.match(source, /path: "\/specs\/\*", element: <SpecDetail \/>/, entry);
    assert.ok(!source.includes("/specs/:topic"), `${entry} still routes a single-segment topic`);
  }
});
