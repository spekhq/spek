import {
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
} from "react";
import { useTheme } from "../contexts/ThemeContext";
import {
  canToggleSource,
  diagramReducer,
  initialDiagramState,
  showsDrawing,
  showsSource,
} from "../utils/diagramState";
import { cssVarReader, resolveDiagramColors } from "../utils/diagramTheme";
import {
  IDENTITY_VIEW,
  isIdentityView,
  panBy,
  resetView,
  viewTransform,
  zoomAt,
  zoomIn,
  zoomOut,
  type DiagramView,
} from "../utils/diagramZoom";

/**
 * Draws Mermaid source.
 *
 * Both entry points share it: a ` ```mermaid ` fence in any Markdown document (rewritten by
 * `rehypeSpekMermaid`) and a root `.mmd` / `.mermaid` artifact tab. One implementation, so the two
 * cannot drift in how they draw, theme, fail or offer their source.
 *
 * Three things here are load-bearing and not obvious:
 *
 * 1. **Only the Web build draws.** It is a real ESM build, so Mermaid lands in lazy chunks a repository
 *    with no diagrams never fetches. The webview, IntelliJ and demo builds are single-file IIFE bundles
 *    that cannot code-split, where the same import is *inlined* — measured at 5.23 MB on a 719 KB
 *    bundle, which would more than double a `docs/demo.html` committed on every release. Those three
 *    show diagram source instead, which is a stated behaviour rather than a degraded one: the source is
 *    the file, and the file is what spek exists to show.
 * 2. **Nothing is drawn until the element is scrolled into view.** This is for **laziness**, not for
 *    measurement: `mermaid.render(id, text)` without a container lays out in a temp div under
 *    `document.body`, so a diagram inside a closed `<details>` measures correctly anyway — an earlier
 *    version of this comment claimed otherwise and was wrong. What the observer buys is that a long
 *    document does not draw every diagram, or load the chunk, until a reader goes near one.
 * 3. **`securityLevel: "strict"`, and `bindFunctions` is deliberately never called.** Diagram source
 *    comes from a repository and is rendered by hosts with more privilege than a browser tab. Click
 *    behaviour a document declares is exactly what a read-only viewer must not run.
 */

interface MermaidDiagramProps {
  /** The diagram source, as the file holds it. */
  source: string;
}

/**
 * Whether this build draws. Replaced at build time by Vite `define`, so the branch below folds to a
 * constant. `typeof` first, because the tests run in plain node where nothing defines it, and a bare
 * reference would be a ReferenceError rather than a default.
 */
declare const __SPEK_DRAWS_DIAGRAMS__: boolean | undefined;
const DRAWS_DIAGRAMS =
  typeof __SPEK_DRAWS_DIAGRAMS__ === "undefined" ? true : __SPEK_DRAWS_DIAGRAMS__;

type MermaidModule = typeof import("mermaid").default;

/**
 * One import for the whole page, memoised so that ten diagrams mounting at once make one request.
 * Not a React hook: the cache must outlive any single component.
 *
 * A **rejection is dropped**, so the next diagram retries. Remembering it would mean one transient
 * chunk failure — a dev server rebuilt while the tab is open, a flaky read — leaves every diagram on
 * the page permanently undrawable until a full reload. CLAUDE.md records the same "remember failures
 * forever" bug in the CLI cache; this is that bug in a promise.
 */
let mermaidPromise: Promise<MermaidModule> | null = null;
function loadMermaid(): Promise<MermaidModule> {
  mermaidPromise ??= import("mermaid")
    .then((m) => m.default)
    .catch((error: unknown) => {
      mermaidPromise = null;
      throw error;
    });
  return mermaidPromise;
}

/** Exported for tests, which must not inherit a previous case's resolved or rejected module. */
export function resetMermaidForTests(): void {
  mermaidPromise = null;
}

/** What the renderer reported, as a string a reader can act on. */
function reasonOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

export function MermaidDiagram({ source }: MermaidDiagramProps) {
  const [state, dispatch] = useReducer(diagramReducer, DRAWS_DIAGRAMS, initialDiagramState);
  const [view, setView] = useState<DiagramView>(IDENTITY_VIEW);
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Mermaid derives every id inside the SVG from this one. Two diagrams sharing it collide, and the
  // symptom is the second diagram drawing with the first one's arrowheads.
  const domId = `spek-mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // Draw when scrolled into view, not when mounted — laziness, not measurement (see the note above).
  // An environment with no IntersectionObserver (the test renderer, an old host) draws immediately
  // rather than never. The observer disconnects after the first hit: `shown` is a one-way door out of
  // `idle`, so every later callback is a no-op that only costs work.
  useEffect(() => {
    if (!DRAWS_DIAGRAMS) return;
    const element = containerRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      dispatch({ type: "shown" });
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      dispatch({ type: "shown" });
      observer.disconnect();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A theme change or an edit to the file makes whatever is on screen stale. The reducer bumps a
  // generation, and the draw below carries it, so a result from the superseded draw is dropped rather
  // than landing on top of the current one.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    dispatch({ type: "invalidated" });
  }, [theme, source]);

  const { generation } = state;
  const drawing = state.status.kind === "drawing";

  // The draw reads the current source and theme through a ref rather than depending on them. Both
  // already reach it through `generation` — the effect above bumps it whenever either changes — so
  // listing them as dependencies only makes a theme toggle run the effect twice: once for the changed
  // theme, once for the generation that change produced. One of the two draws is always wasted.
  const latest = useRef({ source, theme });
  latest.current = { source, theme };

  useEffect(() => {
    if (!drawing) return;
    let cancelled = false;
    void (async () => {
      try {
        const mermaid = await loadMermaid();
        mermaid.initialize({
          startOnLoad: false,
          // Diagram source is untrusted content from a repository: HTML in a label is encoded and click
          // behaviour is disabled. See the component comment.
          securityLevel: "strict",
          // On a parse error Mermaid draws its own "Syntax error" bomb into a temp div under <body>
          // and throws before removing it, so the graphic outlives the failure and sits at the bottom
          // of the page. This capability reports a failure in place, with the reason and the source,
          // so Mermaid's version is never wanted.
          suppressErrorRendering: true,
          // "base" specifically: every other built-in theme ignores most themeVariables, so a partial
          // override silently leaves Mermaid's own palette in place.
          theme: "base",
          themeVariables: {
            ...resolveDiagramColors(cssVarReader(document.documentElement)),
            // Declared in DECLARED_DEFAULTS as "not a colour". The font is the page's, so a diagram's
            // labels read as part of the document rather than as a picture pasted into it.
            fontFamily: getComputedStyle(document.body).fontFamily,
            darkMode: latest.current.theme === "dark",
          },
        });
        const { svg } = await mermaid.render(domId, latest.current.source);
        if (!cancelled) dispatch({ type: "drawSucceeded", svg, generation });
      } catch (error) {
        if (!cancelled) dispatch({ type: "drawFailed", reason: reasonOf(error), generation });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawing, generation, domId]);

  // Mermaid leaves a measuring element behind when a render throws mid-way. Without this, a document
  // with an invalid diagram grows one orphaned node per attempt.
  useEffect(
    () => () => {
      document.getElementById(domId)?.remove();
      document.getElementById(`d${domId}`)?.remove();
    },
    [domId],
  );

  const { status } = state;
  const sourceShown = showsSource(state);
  const drawingShown = showsDrawing(state);

  // The wheel listener is attached natively, not through React's `onWheel`. React registers wheel as
  // a **passive** listener (since v17), so `preventDefault()` inside a React handler is ignored and
  // Ctrl/Cmd+wheel zooms the whole page as well as the diagram. Only `{ passive: false }` can stop it.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      // Modifier-gated: an unmodified wheel must keep scrolling the document. A diagram that swallows
      // the scroll in a narrow VS Code panel is worse than one that cannot be zoomed at all.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      // The origin must be in the transform's own **untransformed** frame: `transformOrigin` is 0 0 on
      // the inner div, so a content point c lands at (viewport content edge + x + c*s). That edge is
      // the viewport's padding box, not its border box — measuring from the border box is off by the
      // padding every step, and measuring from the transformed element itself is worse still, because
      // that box moves as it scales.
      const rect = viewport.getBoundingClientRect();
      const style = getComputedStyle(viewport);
      const originX = event.clientX - rect.left - parseFloat(style.paddingLeft || "0");
      const originY = event.clientY - rect.top - parseFloat(style.paddingTop || "0");
      setView((current) => zoomAt(current, event.deltaY, { x: originX, y: originY }));
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
    // Re-attached when the viewport element is swapped in or out — showing the source unmounts it.
  }, [drawingShown]);

  const dragFrom = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragFrom.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);
  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const from = dragFrom.current;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    dragFrom.current = { x: event.clientX, y: event.clientY };
    setView((current) => panBy(current, dx, dy));
  }, []);
  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragFrom.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      // `[overflow-wrap:normal]` is required, not cosmetic. MarkdownRenderer sets
      // `overflow-wrap: anywhere` on `.markdown-body` so that bare paths in prose cannot widen the
      // page, and that inherits straight into the HTML labels Mermaid renders inside `foreignObject`.
      // Mermaid sizes each label by measuring it first and then fixes the box, assuming a long word
      // stays on one line — so an inherited "break anywhere" silently wraps `MermaidDiagram` after
      // `MermaidDiagra`, puts the `m` on a second line outside a box that was sized for one, and the
      // browser paints no second line. The label looks truncated while the DOM holds the full text,
      // so nothing that inspects `textContent` can see it. Resetting it here keeps Mermaid's own
      // measurement true.
      className="border border-border rounded-lg bg-bg-tertiary mb-4 overflow-hidden [overflow-wrap:normal]"
      data-spek-diagram={state.status.kind}
    >
      <div className="flex items-center justify-end gap-1 px-2 py-1 border-b border-border">
        {drawingShown && (
          <>
            <DiagramButton label="Zoom out" onClick={() => setView(zoomOut)}>
              &minus;
            </DiagramButton>
            <DiagramButton label="Zoom in" onClick={() => setView(zoomIn)}>
              +
            </DiagramButton>
            <DiagramButton
              label="Reset view"
              onClick={() => setView(resetView)}
              disabled={isIdentityView(view)}
            >
              Reset
            </DiagramButton>
          </>
        )}
        {/* Rendered only where there is something to switch between. `diagram-rendering` says no
            control may lead nowhere, and a disabled button is still a control: it occupies the strip,
            reads as available, and invites a click that does nothing. A failed diagram and a build
            that does not draw both already show the source, so the control has no second state. */}
        {canToggleSource(state) && (
          <DiagramButton
            label={state.showSource ? "Show diagram" : "Show source"}
            onClick={() => dispatch({ type: "toggleSource" })}
          >
            {state.showSource ? "Diagram" : "Source"}
          </DiagramButton>
        )}
      </div>

      {status.kind === "unavailable" && (
        // Not an error, and styled as ordinary secondary text rather than as one: nothing went wrong,
        // this surface shows diagram source.
        <p className="px-4 pt-3 text-sm text-text-muted">Mermaid source</p>
      )}

      {status.kind === "failed" && (
        <p className="px-4 pt-3 text-sm text-status-error" role="status">
          This diagram could not be drawn: {status.reason}
        </p>
      )}

      {sourceShown ? (
        // Verbatim and selectable. Not routed through the syntax highlighter: this is the source of a
        // diagram, not a code block, and `markdown-renderer` states that distinction.
        <pre className="p-4 text-sm overflow-x-auto leading-relaxed">
          <code className="block bg-bg-tertiary text-text-primary">{source}</code>
        </pre>
      ) : drawingShown && status.kind === "drawn" ? (
        <div
          ref={viewportRef}
          className="p-4 overflow-hidden cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            style={{ transform: viewTransform(view), transformOrigin: "0 0" }}
            // Mermaid sanitises its own output under securityLevel "strict"; the SVG is markup, so it
            // has to be inserted as markup. React cannot build it element by element from a string.
            dangerouslySetInnerHTML={{ __html: status.svg }}
          />
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-text-muted">Drawing diagram…</p>
      )}
    </div>
  );
}

function DiagramButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-0.5 text-xs rounded border border-border text-text-secondary hover:text-accent disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:text-text-muted"
    >
      {children}
    </button>
  );
}
