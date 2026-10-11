import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IDENTITY_VIEW,
  MAX_SCALE,
  MIN_SCALE,
  isIdentityView,
  panBy,
  resetView,
  viewTransform,
  zoomAt,
  zoomIn,
  zoomOut,
} from "./diagramZoom";

test("a diagram starts unmagnified and unmoved", () => {
  assert.deepEqual(IDENTITY_VIEW, { scale: 1, x: 0, y: 0 });
  assert.equal(isIdentityView(IDENTITY_VIEW), true);
});

test("zooming in and out moves the scale in both directions", () => {
  assert.ok(zoomIn(IDENTITY_VIEW).scale > 1);
  assert.ok(zoomOut(IDENTITY_VIEW).scale < 1);
});

test("the scale is clamped at both ends", () => {
  let view = IDENTITY_VIEW;
  for (let i = 0; i < 50; i++) view = zoomIn(view);
  assert.equal(view.scale, MAX_SCALE);
  for (let i = 0; i < 100; i++) view = zoomOut(view);
  assert.equal(view.scale, MIN_SCALE);
});

test("a diagram can be shrunk below its natural size", () => {
  // The common case is a diagram too wide to fit, and the first useful move is to see the whole shape.
  assert.ok(MIN_SCALE < 1);
});

test("panning accumulates in screen pixels", () => {
  const view = panBy(panBy(IDENTITY_VIEW, 10, -5), -3, 8);
  assert.deepEqual(view, { scale: 1, x: 7, y: 3 });
});

test("wheel zoom keeps the point under the cursor in place", () => {
  const origin = { x: 200, y: 120 };
  const zoomed = zoomAt(IDENTITY_VIEW, -100, origin);
  assert.ok(zoomed.scale > 1);
  // The content point under the cursor before and after must be the same, or the diagram slides away
  // from where the reader is pointing.
  const before = (origin.x - IDENTITY_VIEW.x) / IDENTITY_VIEW.scale;
  const after = (origin.x - zoomed.x) / zoomed.scale;
  assert.ok(Math.abs(before - after) < 1e-9, `${before} vs ${after}`);
});

test("wheel zoom at a limit does not drift the offset", () => {
  const atMax = { scale: MAX_SCALE, x: 12, y: 34 };
  assert.deepEqual(zoomAt(atMax, -500, { x: 200, y: 120 }), atMax);
});

test("reset returns exactly to the first view", () => {
  const moved = zoomIn(panBy(IDENTITY_VIEW, 40, 40));
  assert.equal(isIdentityView(moved), false);
  assert.deepEqual(resetView(), IDENTITY_VIEW);
  assert.equal(isIdentityView(resetView()), true);
});

test("the transform translates before it scales", () => {
  // The other order would make the offset scale too, so a pan would move further the more the reader
  // had zoomed in.
  assert.equal(viewTransform({ scale: 2, x: 10, y: -4 }), "translate(10px, -4px) scale(2)");
});
