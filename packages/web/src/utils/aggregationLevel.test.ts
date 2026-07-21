import { test } from "node:test";
import assert from "node:assert/strict";
import { levelFromPrefs, prefsFromLevel } from "./aggregationLevel.js";

test("levelFromPrefs: aggregate off is always 'off' regardless of jj", () => {
  assert.equal(levelFromPrefs(false, false), "off");
  assert.equal(levelFromPrefs(false, true), "off"); // the previously-invalid combo collapses to off
});

test("levelFromPrefs: aggregate on maps by jj", () => {
  assert.equal(levelFromPrefs(true, false), "worktrees");
  assert.equal(levelFromPrefs(true, true), "worktrees-jj");
});

test("prefsFromLevel: off forces jj off (no invalid state)", () => {
  assert.deepEqual(prefsFromLevel("off"), { aggregate: false, includeJj: false });
  assert.deepEqual(prefsFromLevel("worktrees"), { aggregate: true, includeJj: false });
  assert.deepEqual(prefsFromLevel("worktrees-jj"), { aggregate: true, includeJj: true });
});

test("round-trip: every level survives prefs → level", () => {
  for (const level of ["off", "worktrees", "worktrees-jj"] as const) {
    const p = prefsFromLevel(level);
    assert.equal(levelFromPrefs(p.aggregate, p.includeJj), level);
  }
});
