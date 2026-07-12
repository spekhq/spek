import { test } from "node:test";
import assert from "node:assert/strict";
import { activeHeadingId } from "./scrollspy.js";

test("activeHeadingId: 最後一個越過判定線的 heading 為 active", () => {
  const headings = [
    { id: "a", top: -400 },
    { id: "b", top: 120 },
    { id: "c", top: 800 },
  ];
  assert.equal(activeHeadingId(headings, 236), "b");
});

test("activeHeadingId: 剛用 TOC 捲到的 heading 停在判定線上（含次像素誤差）仍算越線", () => {
  // 錨點把目標停在 offset 線上，捲動位置捨入後 top 可能落在 236.4
  const headings = [
    { id: "a", top: -300 },
    { id: "b", top: 236.4 },
    { id: "c", top: 900 },
  ];
  assert.equal(activeHeadingId(headings, 236), "b");
});

test("activeHeadingId: 尚未 render 的 heading 略過而不中斷掃描", () => {
  const headings = [
    { id: "a", top: -100 },
    { id: "b", top: null },
    { id: "c", top: 100 },
    { id: "d", top: 900 },
  ];
  assert.equal(activeHeadingId(headings, 236), "c");
});

test("activeHeadingId: 全部都還在線下時回第一個", () => {
  const headings = [
    { id: "a", top: 600 },
    { id: "b", top: 900 },
  ];
  assert.equal(activeHeadingId(headings, 236), "a");
});

test("activeHeadingId: 沒有 heading 時回 null", () => {
  assert.equal(activeHeadingId([], 236), null);
});
