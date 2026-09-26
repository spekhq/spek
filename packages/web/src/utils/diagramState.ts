/**
 * The diagram view's state machine, as pure logic.
 *
 * It is separated from the component for the same reason `refreshTracker` and `TreeRefreshGate` are:
 * the interesting behaviour is the sequence of states, and a component test here renders through
 * `renderToStaticMarkup`, which runs no effects and so can never reach any state but the first. A
 * reducer can be driven through all of them deterministically, including the failure path, which is the
 * one a real Mermaid would make hardest to produce on demand.
 *
 * `showSource` is orthogonal to the drawing status on purpose. A reader may ask for the source of a
 * diagram that is still drawing, or of one that failed, and the answer is the same in every case: the
 * file's text, which is the one thing always available. Folding it into the status would make "show me
 * the source" a transition out of `drawn`, and coming back would mean drawing again.
 */

export type DiagramStatus =
  /** Nothing has been requested yet: the element has not been displayed, so Mermaid measures zero. */
  | { kind: "idle" }
  /**
   * This build does not draw. It is a terminal state, and deliberately **not** a failure: nothing went
   * wrong, the surface simply shows diagram source. Reporting it as an error would tell the reader
   * something is broken when what they are looking at is the file.
   */
  | { kind: "unavailable" }
  | { kind: "drawing" }
  | { kind: "drawn"; svg: string }
  /** `reason` is what the renderer reported. It is shown to the reader: an invalid diagram is a fact
   *  about the file they are reading, not an internal error to swallow. */
  | { kind: "failed"; reason: string };

export interface DiagramState {
  status: DiagramStatus;
  showSource: boolean;
  /**
   * Incremented whenever a fresh draw is required. The component keys its effect on this, so a redraw
   * is requested by bumping a number rather than by the effect comparing its own inputs — and a result
   * arriving from a superseded draw can be recognised and dropped.
   */
  generation: number;
}

export type DiagramEvent =
  /** The element is now displayed, so a draw can produce real measurements. */
  | { type: "shown" }
  | { type: "drawSucceeded"; svg: string; generation: number }
  | { type: "drawFailed"; reason: string; generation: number }
  | { type: "toggleSource" }
  /** The theme changed, or the source did: whatever is on screen is now stale. */
  | { type: "invalidated" };

/**
 * The starting state for this build.
 *
 * A build that cannot draw starts terminal rather than passing through `idle`: there is no observer to
 * wait for and no draw to attempt, and a state the machine can never leave should not be reachable only
 * by an event that never arrives.
 */
export const initialDiagramState = (drawsDiagrams: boolean): DiagramState => ({
  status: { kind: drawsDiagrams ? "idle" : "unavailable" },
  showSource: false,
  generation: 0,
});

export function diagramReducer(state: DiagramState, event: DiagramEvent): DiagramState {
  switch (event.type) {
    case "shown":
      // Only from idle — `unavailable` is terminal, so an observer firing on a build that cannot draw
      // must not start a draw that would immediately fail. A second intersection callback — which IntersectionObserver fires freely as the
      // reader scrolls — must not restart a drawing or discard a drawn diagram.
      if (state.status.kind !== "idle") return state;
      return { ...state, status: { kind: "drawing" } };

    case "drawSucceeded":
      // A result from a superseded draw is dropped. Without this, a theme toggle during a slow draw
      // lands the old theme's SVG on top of the new one's, and nothing on screen says which it is.
      if (event.generation !== state.generation) return state;
      return { ...state, status: { kind: "drawn", svg: event.svg } };

    case "drawFailed":
      if (event.generation !== state.generation) return state;
      return { ...state, status: { kind: "failed", reason: event.reason } };

    case "toggleSource":
      return { ...state, showSource: !state.showSource };

    case "invalidated":
      // Nothing to redraw on a build that does not draw: the source it shows is already current.
      if (state.status.kind === "unavailable") return state;
      // An `idle` diagram has never been scrolled to, so there is nothing stale to replace. Moving it
      // to `drawing` makes a theme toggle — or an edit, or StrictMode's second mount in dev — draw
      // every diagram in the document at once and pull in the chunk, which is exactly the work the
      // observer exists to defer. It stays idle and draws when the reader reaches it.
      if (state.status.kind === "idle") return state;
      // Straight back to drawing, not to idle: the element is already displayed, so waiting for another
      // intersection would leave a diagram that never redraws for a reader who has not scrolled. The
      // generation bump is what makes the in-flight result droppable.
      //
      // `showSource` is deliberately preserved. A reader looking at the source when the theme changes is
      // reading it; flipping them back to a drawing would discard what they were doing for a change they
      // did not make to this diagram.
      return { ...state, status: { kind: "drawing" }, generation: state.generation + 1 };
  }
}

/** Whether the drawing is what the reader should see, as opposed to the source or a failure notice. */
export const showsDrawing = (state: DiagramState): boolean =>
  !state.showSource && state.status.kind === "drawn";

/** Whether the source is on screen — because it was asked for, or because there is nothing else to show. */
export const showsSource = (state: DiagramState): boolean =>
  state.showSource || state.status.kind === "failed" || state.status.kind === "unavailable";

/** Whether there is a drawing to toggle back to. Nothing to switch between means no switch control. */
export const canToggleSource = (state: DiagramState): boolean =>
  state.status.kind !== "failed" && state.status.kind !== "unavailable";
