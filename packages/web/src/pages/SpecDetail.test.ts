import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRoutes } from "react-router-dom";
import { isSafeSpecTopic } from "@spekjs/core/spec-topic";
import { specTopicFromSplat } from "./SpecDetail";

test("the /specs/* splat keeps a trailing slash, which no topic carries", () => {
  const splat = matchRoutes([{ path: "/specs/*" }], "/specs/auth/")?.[0].params["*"];
  assert.equal(splat, "auth/");
  assert.equal(isSafeSpecTopic("auth/"), false);
});

test("a trailing slash in a spec URL is dropped from the topic", () => {
  assert.equal(specTopicFromSplat("auth/"), "auth");
  assert.equal(specTopicFromSplat("contracts/pagination//"), "contracts/pagination");
  assert.equal(specTopicFromSplat("contracts/pagination"), "contracts/pagination");
  assert.equal(specTopicFromSplat(undefined), "");
});
