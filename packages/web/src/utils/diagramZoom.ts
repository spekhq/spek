/**
 * The diagram's magnification and offset, as pure logic.
 *
 * An architecture diagram is authored at desktop width and read in a VS Code panel, an IntelliJ tool
 * window or a phone — all narrow. Magnify-and-move is what makes it readable there, and it is arithmetic,
 * so it is written once here and tested directly rather than being observed through a component that
 * cannot lay anything out under `renderToStaticMarkup`.
 */

export interface DiagramView {
  scale: number;
  /** Offset in CSS pixels, applied before the scale, so panning is in screen units at any zoom. */
  x: number;
  y: number;
}

export const IDENTITY_VIEW: DiagramView = { scale: 1, x: 0, y: 0 };

/**
 * The magnification range. The floor is below 1 because the common case is a diagram too *wide*, and
 * the first useful thing a reader does with one is shrink it to see the shape.
 */
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;
/** One press is a noticeable but not disorienting step; four presses roughly double or halve. */
const STEP = 1.2;

const clampScale = (scale: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

export const zoomIn = (view: DiagramView): DiagramView => ({
  ...view,
  scale: clampScale(view.scale * STEP),
});

export const zoomOut = (view: DiagramView): DiagramView => ({
  ...view,
  scale: clampScale(view.scale / STEP),
});

/**
 * Zoom by a wheel delta, keeping the point under the cursor where it is.
 *
 * Without the offset correction the diagram grows from its own origin and whatever the reader was
 * pointing at slides out of view, which reads as the diagram running away from the cursor.
 * `origin` is the cursor position relative to the viewport's top-left.
 */
export function zoomAt(view: DiagramView, delta: number, origin: { x: number; y: number }): DiagramView {
  const scale = clampScale(view.scale * Math.exp(-delta / 500));
  if (scale === view.scale) return view; // at a limit: do not drift the offset for a zoom that did not happen
  const ratio = scale / view.scale;
  return {
    scale,
    x: origin.x - (origin.x - view.x) * ratio,
    y: origin.y - (origin.y - view.y) * ratio,
  };
}

export const panBy = (view: DiagramView, dx: number, dy: number): DiagramView => ({
  ...view,
  x: view.x + dx,
  y: view.y + dy,
});

export const resetView = (): DiagramView => IDENTITY_VIEW;

/** True when the view is exactly as first shown, so the reset control can say it has nothing to do. */
export const isIdentityView = (view: DiagramView): boolean =>
  view.scale === 1 && view.x === 0 && view.y === 0;

/** The transform for the wrapper. Translate before scale, so `x`/`y` stay screen pixels. */
export const viewTransform = (view: DiagramView): string =>
  `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
