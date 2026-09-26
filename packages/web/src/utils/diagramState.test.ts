import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canToggleSource,
  diagramReducer,
  initialDiagramState,
  showsDrawing,
  showsSource,
  type DiagramEvent,
  type DiagramState,
} from "./diagramState";

/** The state a build that draws starts in. The other build is covered by its own tests below. */
const DRAWING_BUILD = initialDiagramState(true);

const run = (events: DiagramEvent[], from: DiagramState = DRAWING_BUILD): DiagramState =>
  events.reduce(diagramReducer, from);

test("a diagram starts idle and draws nothing until it is shown", () => {
  assert.equal(DRAWING_BUILD.status.kind, "idle");
  assert.equal(showsDrawing(DRAWING_BUILD), false);
  assert.equal(showsSource(DRAWING_BUILD), false);
});

test("being shown starts a draw", () => {
  const state = run([{ type: "shown" }]);
  assert.equal(state.status.kind, "drawing");
});

test("a second intersection does not restart a drawn diagram", () => {
  // IntersectionObserver fires as the reader scrolls, repeatedly. Restarting here would redraw a
  // finished diagram every time it re-entered the viewport.
  const state = run([
    { type: "shown" },
    { type: "drawSucceeded", svg: "<svg/>", generation: 0 },
    { type: "shown" },
  ]);
  assert.deepEqual(state.status, { kind: "drawn", svg: "<svg/>" });
});

test("a successful draw shows the drawing", () => {
  const state = run([{ type: "shown" }, { type: "drawSucceeded", svg: "<svg id='a'/>", generation: 0 }]);
  assert.deepEqual(state.status, { kind: "drawn", svg: "<svg id='a'/>" });
  assert.equal(showsDrawing(state), true);
  assert.equal(showsSource(state), false);
});

test("a failed draw keeps the reason and falls back to the source", () => {
  const state = run([
    { type: "shown" },
    { type: "drawFailed", reason: "Parse error on line 2", generation: 0 },
  ]);
  assert.deepEqual(state.status, { kind: "failed", reason: "Parse error on line 2" });
  assert.equal(showsDrawing(state), false);
  // The reader came to read a file. A diagram that cannot be drawn is still that file.
  assert.equal(showsSource(state), true);
});

test("the source toggles both ways", () => {
  const drawn = run([{ type: "shown" }, { type: "drawSucceeded", svg: "<svg/>", generation: 0 }]);
  assert.equal(canToggleSource(drawn), true);
  const shown = diagramReducer(drawn, { type: "toggleSource" });
  assert.equal(showsSource(shown), true);
  assert.equal(showsDrawing(shown), false);
  const back = diagramReducer(shown, { type: "toggleSource" });
  assert.equal(showsDrawing(back), true);
  // Toggling never discards the drawing, so coming back costs no redraw.
  assert.deepEqual(back.status, { kind: "drawn", svg: "<svg/>" });
});

test("the source is reachable while a diagram is still drawing", () => {
  const state = run([{ type: "shown" }, { type: "toggleSource" }]);
  assert.equal(state.status.kind, "drawing");
  assert.equal(showsSource(state), true);
});

test("invalidation redraws without waiting to be shown again", () => {
  const drawn = run([{ type: "shown" }, { type: "drawSucceeded", svg: "<svg/>", generation: 0 }]);
  const after = diagramReducer(drawn, { type: "invalidated" });
  assert.equal(after.status.kind, "drawing");
  assert.equal(after.generation, 1);
});

test("a result from a superseded draw is dropped", () => {
  // The bug this prevents: a theme toggle mid-draw, then the old theme's SVG arriving last and winning.
  const state = run([
    { type: "shown" },
    { type: "invalidated" },
    { type: "drawSucceeded", svg: "<svg id='stale'/>", generation: 0 },
  ]);
  assert.equal(state.status.kind, "drawing", "the stale result must not land");
  const settled = diagramReducer(state, {
    type: "drawSucceeded",
    svg: "<svg id='fresh'/>",
    generation: 1,
  });
  assert.deepEqual(settled.status, { kind: "drawn", svg: "<svg id='fresh'/>" });
});

test("a superseded failure is dropped too", () => {
  const state = run([
    { type: "shown" },
    { type: "invalidated" },
    { type: "drawFailed", reason: "stale", generation: 0 },
  ]);
  assert.equal(state.status.kind, "drawing");
});

test("invalidation keeps the reader on the source if that is what they were reading", () => {
  const reading = run([
    { type: "shown" },
    { type: "drawSucceeded", svg: "<svg/>", generation: 0 },
    { type: "toggleSource" },
  ]);
  const after = diagramReducer(reading, { type: "invalidated" });
  assert.equal(after.showSource, true);
});

// --- A build that does not draw ---------------------------------------------
//
// Only the Web build draws. The VS Code, IntelliJ and demo bundles are single files that cannot
// code-split, so Mermaid is excluded from them outright and those surfaces show diagram source.

test("a build that does not draw starts in a terminal state showing the source", () => {
  const state = initialDiagramState(false);
  assert.equal(state.status.kind, "unavailable");
  assert.equal(showsSource(state), true);
  assert.equal(showsDrawing(state), false);
});

test("not drawing is not a failure", () => {
  // The distinction is the whole point of the separate state: nothing went wrong, so nothing should
  // tell the reader something did.
  assert.notEqual(initialDiagramState(false).status.kind, "failed");
});

test("an observer firing on a build that does not draw starts nothing", () => {
  const state = diagramReducer(initialDiagramState(false), { type: "shown" });
  assert.equal(state.status.kind, "unavailable");
});

test("invalidation does not start a draw on a build that does not draw", () => {
  // A theme toggle must not move a surface with no Mermaid into a draw that can only fail.
  const state = diagramReducer(initialDiagramState(false), { type: "invalidated" });
  assert.deepEqual(state, initialDiagramState(false));
});

test("there is no drawing to switch to, so the toggle is not offered", () => {
  assert.equal(canToggleSource(initialDiagramState(false)), false);
  const failed = run([{ type: "shown" }, { type: "drawFailed", reason: "nope", generation: 0 }]);
  assert.equal(canToggleSource(failed), false);
});

test("invalidation leaves an unseen diagram alone", () => {
  // Reported in review: a theme toggle moved every idle diagram to `drawing`, drawing the whole
  // document and loading the chunk for diagrams the reader had never scrolled to — and StrictMode's
  // second effect run made that happen on mount in dev.
  const state = diagramReducer(DRAWING_BUILD, { type: "invalidated" });
  assert.equal(state.status.kind, "idle");
  assert.deepEqual(state, DRAWING_BUILD);
});

test("an unseen diagram still draws when it is finally shown", () => {
  // The other half: staying idle must not mean never drawing.
  const after = run([{ type: "invalidated" }, { type: "shown" }]);
  assert.equal(after.status.kind, "drawing");
});

test("invalidation still redraws a diagram that has been drawn", () => {
  const drawn = run([{ type: "shown" }, { type: "drawSucceeded", svg: "<svg/>", generation: 0 }]);
  assert.equal(diagramReducer(drawn, { type: "invalidated" }).status.kind, "drawing");
});
