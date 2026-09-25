import { test } from "node:test";
import assert from "node:assert/strict";
import { webviewLinkClickAction } from "./webviewLinkGuard.js";

// The two document URLs a webview is served from: desktop VS Code and a browser-hosted one.
const DESKTOP = "vscode-webview://0abc123def/index.html?id=0abc123def&parentId=1&origin=xyz";
const BROWSER = "https://1ub25l16b6b2tcgssjq7gb.assets.github.dev/stable/abc/out/vs/workbench/contrib/webview/browser/pre/index.html?id=x";

function action(documentHref: string, hrefAttribute: string, handled: boolean) {
  return webviewLinkClickAction({
    hrefAttribute,
    href: new URL(hrefAttribute, documentHref).href,
    documentHref,
    handled,
  });
}

test("a route link the router handled is blocked, in both hosts", () => {
  assert.equal(action(BROWSER, "/changes", true), "block");
  assert.equal(action(DESKTOP, "/changes", true), "block");
});

test("an in-app link the app did not handle is blocked (modified click, relative markdown link)", () => {
  assert.equal(action(BROWSER, "/changes", false), "block");
  assert.equal(action(DESKTOP, "/specs/foo", false), "block");
  assert.equal(action(BROWSER, "../other/spec.md", false), "block");
});

test("a vscode-webview:// link is in-app even though its URL origin is \"null\"", () => {
  assert.equal(new URL("/changes", DESKTOP).origin, "null");
  assert.equal(action(DESKTOP, "/changes", false), "block");
});

test("a link to another host or scheme passes to VS Code", () => {
  assert.equal(action(BROWSER, "https://github.com/spekhq/spek", false), "pass");
  assert.equal(action(DESKTOP, "https://github.com/spekhq/spek", false), "pass");
  assert.equal(action(BROWSER, "mailto:someone@example.com", false), "pass");
  // Another host is external even when the app handled the click.
  assert.equal(action(BROWSER, "https://github.com/spekhq/spek", true), "pass");
});

test("a bare fragment the app did not handle passes to VS Code's own scroll", () => {
  assert.equal(action(BROWSER, "#requirement-foo", false), "pass");
  assert.equal(action(DESKTOP, "#requirement-foo", false), "pass");
  assert.equal(action(BROWSER, "#", false), "pass");
});

test("a bare fragment the app already scrolled to (the spec TOC) is blocked", () => {
  assert.equal(action(BROWSER, "#requirement-foo", true), "block");
  assert.equal(action(DESKTOP, "#requirement-foo", true), "block");
});

test("an unparsable URL is left to VS Code", () => {
  assert.equal(
    webviewLinkClickAction({ hrefAttribute: "x", href: "not a url", documentHref: BROWSER, handled: false }),
    "pass",
  );
});
