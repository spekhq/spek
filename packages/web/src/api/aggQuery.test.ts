import { test } from "node:test";
import assert from "node:assert/strict";
import { aggQuery } from "./FetchAdapter.js";

// `aggregate` 預設開啟：省略即開，只在明確關閉時帶參。
test("aggQuery: aggregate defaults on — only emits aggregate=false when explicitly off", () => {
  assert.equal(aggQuery(undefined, undefined), "");
  assert.equal(aggQuery(true, undefined), "");
  assert.equal(aggQuery(false, undefined), "&aggregate=false");
});

// `jj` 預設關閉（實驗性）：只在明確開啟時帶 jj=true。
// 迴歸守衛：舊版只在 includeJj===false 時帶 jj=false，導致「開啟」時什麼都不送，
// 而 server 預設 jj 為關 → toggle 變成 no-op。
test("aggQuery: jj defaults off (experimental) — only emits jj=true when explicitly on", () => {
  assert.equal(aggQuery(undefined, false), "");
  assert.equal(aggQuery(undefined, true), "&jj=true"); // was "" before the fix — the bug
  assert.equal(aggQuery(true, true), "&jj=true");
  assert.equal(aggQuery(false, true), "&aggregate=false&jj=true");
});
