import { test } from "node:test";
import assert from "node:assert/strict";
import type { GraphNode } from "@spekjs/core";
import { collideRadius } from "../SpecGraph.js";

/**
 * The collide force keeps two nodes `collideRadius(a) + collideRadius(b)` apart, so that distance has
 * to clear both nodes *and* both labels in every direction. A radius covering only the node let the
 * layout park a label on its neighbour, which is the overlap this guards.
 *
 * Geometry as `SpecGraph` draws it: a spec is a circle of radius r, a change a 2r x 1.4r rectangle,
 * and a label is centred under its node with its baseline r + 16 below the centre, in 12px text
 * with a 1.5px halo.
 */

type Box = { x0: number; x1: number; y0: number; y1: number };
type Shape = { circle: true; cx: number; cy: number; r: number } | ({ circle: false } & Box);

const spec = (historyCount: number): GraphNode => ({ id: "s", type: "spec", label: "s", historyCount });
const change = (specCount: number): GraphNode => ({ id: "c", type: "change", label: "c", specCount });

// Radii fixed by `graph-view`: spec 20-45 by history, change capped at 40.
const cases: { node: GraphNode; r: number; labelWidth: number }[] = [
  { node: spec(0), r: 20, labelWidth: 12 },
  { node: spec(5), r: 45, labelWidth: 170 },
  { node: spec(5), r: 45, labelWidth: 12 },
  { node: change(1), r: 20, labelWidth: 170 },
  { node: change(6), r: 40, labelWidth: 0 },
  { node: change(6), r: 40, labelWidth: 170 },
];

function shapeAt(c: (typeof cases)[number], x: number, y: number): Shape {
  return c.node.type === "spec"
    ? { circle: true, cx: x, cy: y, r: c.r }
    : { circle: false, x0: x - c.r, x1: x + c.r, y0: y - 0.7 * c.r, y1: y + 0.7 * c.r };
}

function labelAt(c: (typeof cases)[number], x: number, y: number): Box {
  const half = c.labelWidth / 2 + 1.5;
  const baseline = y + c.r + 16;
  return { x0: x - half, x1: x + half, y0: baseline - 12 - 1.5, y1: baseline + 5 };
}

const boxesMeet = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function meets(a: Shape | Box, b: Shape | Box): boolean {
  const asShape = (s: Shape | Box): Shape => ("circle" in s ? s : { circle: false, ...s });
  const p = asShape(a);
  const q = asShape(b);
  if (p.circle && q.circle) return Math.hypot(p.cx - q.cx, p.cy - q.cy) < p.r + q.r;
  if (!p.circle && !q.circle) return boxesMeet(p, q);
  const [c, box] = p.circle ? [p, q as Box] : [q as Extract<Shape, { circle: true }>, p];
  const dx = c.cx - Math.max(box.x0, Math.min(c.cx, box.x1));
  const dy = c.cy - Math.max(box.y0, Math.min(c.cy, box.y1));
  return Math.hypot(dx, dy) < c.r;
}

test("two nodes held apart by their collide radii never touch each other or each other's labels", () => {
  for (const a of cases) {
    for (const b of cases) {
      const distance = collideRadius(a.node, a.labelWidth) + collideRadius(b.node, b.labelWidth);
      for (let deg = 0; deg < 360; deg += 2) {
        const bx = distance * Math.cos((deg * Math.PI) / 180);
        const by = distance * Math.sin((deg * Math.PI) / 180);
        const where = `${a.node.type} r=${a.r} w=${a.labelWidth} vs ${b.node.type} r=${b.r} w=${b.labelWidth} at ${deg}deg`;
        assert.ok(!meets(shapeAt(a, 0, 0), shapeAt(b, bx, by)), `nodes overlap: ${where}`);
        assert.ok(!meets(labelAt(a, 0, 0), shapeAt(b, bx, by)), `label on node: ${where}`);
        assert.ok(!meets(shapeAt(a, 0, 0), labelAt(b, bx, by)), `node on label: ${where}`);
        assert.ok(!boxesMeet(labelAt(a, 0, 0), labelAt(b, bx, by)), `labels overlap: ${where}`);
      }
    }
  }
});

test("a wider label claims more room", () => {
  assert.ok(collideRadius(spec(0), 170) > collideRadius(spec(0), 40));
  assert.ok(collideRadius(spec(0), 170) >= 85, "a node must hold at least half its label's width");
});
