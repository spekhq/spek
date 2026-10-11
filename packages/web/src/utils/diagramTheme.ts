/**
 * The palette handed to Mermaid, declared as data so it can be measured.
 *
 * Mermaid ships its own colours and writes them into the SVG it generates at view time. That is a
 * mechanism by which colour reaches the screen which `contrast.test.ts` structurally cannot see: the
 * values are properties of a configuration object rather than classes on an element, and the elements
 * they land on do not exist until a reader opens the page. A scan finds nothing to report, which is
 * indistinguishable from finding nothing wrong — the same shape as the SVG-attribute gap that let a
 * whole diagram sit at 1.13:1 while the palette was reported as conforming.
 *
 * So the measurement is made at the **declaration**: this table is the complete set of colours the
 * application hands over, each naming the `--color-*` token it comes from and the floor its use answers
 * to. `contrast.test.ts` imports it and measures every entry in both themes. Adding a key here without a
 * role is a type error; naming a token `global.css` does not define fails a test.
 *
 * Two rules this table exists to keep:
 *
 * - **No literals.** A hex here is an untokenized literal in a place no stylesheet review would look. The
 *   only values are token names, resolved against the document at draw time, so re-authoring a token in
 *   `global.css` re-authors the diagram and re-measures it.
 * - **No silent defaults.** Every base variable that would otherwise take Mermaid's own value is either
 *   in this table or listed in `DECLARED_DEFAULTS` with why it owes nothing. Mermaid's defaults are
 *   chosen against Mermaid's assumed background, not this application's.
 */

/**
 * What a colour in the palette is for, and therefore what floor it answers to.
 *
 * Floors are measured against the worst of the theme's three surfaces, as the rest of the palette check
 * is: there is no map of which diagram lands on which panel, and a node's own fill is `bg-tertiary`,
 * which is one of the three.
 */
export type DiagramColorRole =
  /** Drawn as text — node labels, edge labels, titles. WCAG 1.4.3: 4.5:1. */
  | { kind: "text" }
  /** A line or border that is the sole carrier of its meaning — an edge, a node outline. 1.4.11: 3:1. */
  | { kind: "graphic" }
  /** A fill behind other marks. It owes nothing itself; what is drawn on it is measured against it. */
  | { kind: "surface"; reason: string }
  /**
   * Text drawn on other tokens' solid fills rather than on a page surface — `on` names every fill it
   * can land on, and it is measured against each. Measured against them, not against the page: a sequence
   * `autonumber` sits on a filled circle, and measuring it against the background it never touches is how
   * it reached about 2.1:1 unnoticed. A list because Mermaid often uses one text variable on several
   * fills: a gantt task label sits on a normal bar or a critical one, a pie percentage on any slice.
   */
  | { kind: "textOn"; on: string[] };

export interface DiagramColor {
  /** The `--color-*` token, without the prefix, exactly as `global.css` spells it. */
  token: string;
  role: DiagramColorRole;
  /** Where this reaches the reader, so a later use the label does not describe reads as undeclared. */
  label: string;
}

const text = (token: string, label: string): DiagramColor => ({ token, role: { kind: "text" }, label });
const graphic = (token: string, label: string): DiagramColor => ({
  token,
  role: { kind: "graphic" },
  label,
});
const surface = (token: string, label: string, reason: string): DiagramColor => ({
  token,
  role: { kind: "surface", reason },
  label,
});
const textOn = (token: string, on: string[], label: string): DiagramColor => ({
  token,
  role: { kind: "textOn", on },
  label,
});

/**
 * The categorical ramp in `global.css`, in its order.
 *
 * Handed to pie slices only, because a pie is where hue is the *only* key: a legend entry names its slice
 * by colour and nothing else. Mermaid has two more categorical sets — `cScale*` (mindmap, timeline and
 * journey sections) and `git*` (branches) — where hue repeats what structure already says: a mindmap
 * branch is its position, a git branch carries its name. Those keep their surface-derived fills, legible
 * but not told apart by hue. Handing them the ramp is possible (Mermaid applies a supplied value as
 * given) but is not just these keys: Mermaid derives an inverted and a "peer" colour from each, used for
 * edges and borders, and those would have to be declared and measured too.
 */
export const CATEGORICAL = [
  "cat-1",
  "cat-2",
  "cat-3",
  "cat-4",
  "cat-5",
  "cat-6",
  "cat-7",
  "cat-8",
] as const;

/**
 * Non-colour theme variables set alongside the palette, because Mermaid's own value would change what a
 * colour in it measures. Only values that do that belong here; a setting with no bearing on colour is
 * Mermaid's to keep.
 */
export const DIAGRAM_SETTINGS: Record<string, string> = {
  // Mermaid draws pie slices at 0.7, which composites each slice with the page behind it. The ratios
  // measured for the ramp are at full strength, so they hold only at 1.
  pieOpacity: "1",
};

/**
 * Mermaid `themeVariables` key -> the token it takes its value from.
 *
 * The keys are Mermaid's `base` theme variables. `base` specifically: Mermaid's other built-in themes
 * ignore most of these, so a partial override silently leaves the library's own colours in place, which
 * is precisely the failure this table exists to prevent.
 *
 * The per-diagram-type keys (sequence, note, cluster) are here rather than left to Mermaid's derivation
 * because derivation is the same silent default by another route: `base` computes them from
 * `primaryColor` with its own lightening, which is arithmetic performed against an assumed background.
 */
export const DIAGRAM_COLORS: Record<string, DiagramColor> = {
  // --- Surfaces ---
  background: surface("bg-primary", "the page the diagram is drawn on", "a fill; what sits on it is measured against it"),
  mainBkg: surface("bg-tertiary", "flowchart node fill", "a fill; node text is measured against it"),
  primaryColor: surface("bg-tertiary", "primary node fill", "a fill; node text is measured against it"),
  secondaryColor: surface("bg-secondary", "secondary node fill, cluster background", "a fill"),
  tertiaryColor: surface("bg-secondary", "tertiary node fill", "a fill"),
  clusterBkg: surface("bg-secondary", "subgraph background", "a fill"),
  noteBkgColor: surface("bg-secondary", "note fill", "a fill; note text is measured against it"),
  labelBackgroundColor: surface("bg-secondary", "edge label backing", "a fill; the label on it is measured"),
  edgeLabelBackground: surface("bg-secondary", "edge label backing", "a fill; the label on it is measured"),
  actorBkg: surface("bg-tertiary", "sequence actor box fill", "a fill; actor text is measured against it"),
  labelBoxBkgColor: surface("bg-tertiary", "sequence loop label fill", "a fill"),
  activationBkgColor: surface("bg-tertiary", "sequence activation bar fill", "a fill"),

  // --- Text ---
  textColor: text("text-primary", "general diagram text"),
  primaryTextColor: text("text-primary", "text inside a primary node"),
  secondaryTextColor: text("text-primary", "text inside a secondary node"),
  tertiaryTextColor: text("text-primary", "text inside a tertiary node"),
  nodeTextColor: text("text-primary", "flowchart node label"),
  titleColor: text("text-primary", "diagram title"),
  labelColor: text("text-primary", "edge label"),
  actorTextColor: text("text-primary", "sequence actor name"),
  signalTextColor: text("text-primary", "sequence message label"),
  loopTextColor: text("text-primary", "sequence loop label"),
  noteTextColor: text("text-primary", "note body"),
  labelTextColor: text("text-primary", "sequence loop label text"),
  classText: text("text-primary", "class diagram member text"),
  // Drawn inside a circle filled with signalColor, not on the page. As text-primary on that fill it
  // measured about 2.1:1 dark and 2.4:1 light; a surface token on it clears the floor in both.
  sequenceNumberColor: textOn("bg-primary", ["text-secondary"], "sequence autonumber, on the signal circle"),
  altBackground: surface("bg-secondary", "sequence alt block backing", "a fill"),

  // --- Graphics that carry their own meaning ---
  // An edge is the only thing saying one node leads to another, so it owes 3:1 — the same judgement the
  // schema workflow diagram's edges already carry in NON_TEXT.
  lineColor: graphic("text-secondary", "flowchart edge"),
  signalColor: graphic("text-secondary", "sequence message arrow"),
  defaultLinkColor: graphic("text-secondary", "default link"),
  // A node's outline is what separates it from the one beside it in a dense graph, where fills of the
  // same surface token abut.
  primaryBorderColor: graphic("fold-rule", "node outline"),
  secondaryBorderColor: graphic("fold-rule", "secondary node outline"),
  tertiaryBorderColor: graphic("fold-rule", "tertiary node outline"),
  nodeBorder: graphic("fold-rule", "flowchart node outline"),
  clusterBorder: graphic("fold-rule", "subgraph outline"),
  noteBorderColor: graphic("fold-rule", "note outline"),
  actorBorder: graphic("fold-rule", "sequence actor box outline"),
  actorLineColor: graphic("fold-rule", "sequence lifeline"),
  labelBoxBorderColor: graphic("fold-rule", "sequence loop label outline"),
  activationBorderColor: graphic("fold-rule", "sequence activation bar outline"),

  // --- Gantt. Several of these are hard-coded literals in Mermaid's base theme, so a dark gantt drew
  // light text on `lightgrey` at about 1.1:1 until they were declared here.
  //
  // Which text lands on which bar is Mermaid's choice, read from its gantt styles, and it is what this
  // block is built around. A normal bar and a critical bar share one label variable (`taskTextColor`), so
  // both are solid fills that one label colour clears. Done and active bars take `taskTextDarkColor`,
  // which also labels text outside any bar, on the page — so it must be page text, and those two bars are
  // page surfaces told apart by their outlines. An active bar's solid fill was tried and cannot work: a
  // fill 3:1 from the page and 4.5:1 under page text exists in neither theme. ---
  altSectionBkgColor: surface("bg-secondary", "alternating gantt section band", "a fill"),
  excludeBkgColor: surface("bg-tertiary", "excluded gantt period", "a fill"),
  taskBkgColor: graphic("text-secondary", "gantt task bar"),
  taskBorderColor: graphic("text-secondary", "gantt task bar outline"),
  critBkgColor: graphic("status-error", "critical gantt task bar"),
  taskTextColor: textOn(
    "bg-primary",
    ["text-secondary", "status-error"],
    "gantt label inside a normal or critical bar",
  ),
  doneTaskBkgColor: surface("bg-tertiary", "completed gantt task fill", "a fill; its label is taskTextDarkColor, measured as page text"),
  activeTaskBkgColor: surface("bg-secondary", "active gantt task fill", "a fill; its label is taskTextDarkColor, measured as page text"),
  // The outline is the only thing marking a task active, so it owes 3:1 and carries the accent.
  activeTaskBorderColor: graphic("accent", "active gantt task outline"),
  taskTextDarkColor: text("text-primary", "gantt label on a done or active bar, or beside any bar"),
  taskTextOutsideColor: text("text-primary", "gantt label beside a bar"),
  gridColor: graphic("fold-rule", "gantt grid line"),
  vertLineColor: graphic("fold-rule", "gantt section divider"),
  doneTaskBorderColor: graphic("fold-rule", "completed gantt task outline"),
  critBorderColor: graphic("status-error", "critical gantt task outline"),
  todayLineColor: graphic("accent", "gantt today marker"),
  taskTextClickableColor: text("accent", "clickable gantt task label"),

  // --- Pie. Hue is the information here: a legend entry names a slice only by its colour, so the
  // slices take the categorical ramp rather than anything derived from a surface (which made every slice
  // the same near-black in dark and near-white in light). The ramp has eight hues; Mermaid has twelve
  // slots, so a ninth slice repeats the first, and a pie with more than eight slices cannot be read by
  // colour alone. Opacity is set to 1 alongside this table (DIAGRAM_SETTINGS): Mermaid's 0.7 would
  // blend each slice into the page and void every ratio measured here. ---
  ...Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [
      `pie${i + 1}`,
      graphic(CATEGORICAL[i % CATEGORICAL.length], `pie slice ${i + 1} and its legend swatch`),
    ]),
  ),
  pieSectionTextColor: textOn("bg-primary", [...CATEGORICAL], "pie slice percentage, on any slice"),
  pieTitleTextColor: text("text-primary", "pie title"),
  pieLegendTextColor: text("text-primary", "pie legend entry"),

  // --- ER, architecture. Slice and cell separators, and edges that state a dependency. ---
  pieStrokeColor: graphic("fold-rule", "pie slice separator"),
  pieOuterStrokeColor: graphic("fold-rule", "pie outer edge"),
  attributeBackgroundColorOdd: surface("bg-secondary", "ER attribute row", "a fill"),
  attributeBackgroundColorEven: surface("bg-tertiary", "ER attribute row", "a fill"),
  archEdgeColor: graphic("text-secondary", "architecture edge"),
  archEdgeArrowColor: graphic("text-secondary", "architecture arrowhead"),
  archGroupBorderColor: graphic("fold-rule", "architecture group outline"),
  wardleyEvolutionColor: graphic("fold-rule", "Wardley evolution divider"),
};

/**
 * Base variables deliberately left to Mermaid, each with why it owes nothing.
 *
 * "Mermaid would supply it" is not itself a reason — that is the silent default this table exists to
 * close. What each entry records is that the variable carries no colour a reader depends on, or is not a
 * colour at all.
 */
export const DECLARED_DEFAULTS: Record<string, string> = {
  fontFamily: "not a colour — set from the application's own font stack alongside this table",
  fontSize: "not a colour",
  darkMode:
    "not a colour — a flag telling Mermaid which direction to derive any value this table does not " +
    "set, so that a derivation still lands on the right side of the page",
  pieOpacity: "not a colour — set to 1 in DIAGRAM_SETTINGS, alongside this table",
  // The event-model block palette. Hue here IS the information: which pastel a block carries is what
  // says whether it is a command, an event, a read model, a processor or UI. The categorical ramp exists
  // now, but it cannot be handed over: its fills are measured under `bg-primary` labels, and Mermaid
  // gives event-model block labels no colour variable — they inherit the page's text colour, which the
  // ramp's bright dark-theme fills do not clear. So they stay Mermaid's own light-theme pastels, legible
  // in the light theme and poor in the dark one, until Mermaid exposes the label colour.
  emUiFill: "categorical hue carries the block kind; its label colour is not a theme variable, so the ramp cannot be measured under it",
  emUiStroke: "outline of the above",
  emProcessorFill: "categorical hue carries the block kind",
  emProcessorStroke: "outline of the above",
  emReadModelFill: "categorical hue carries the block kind",
  emReadModelStroke: "outline of the above",
  emCommandFill: "categorical hue carries the block kind",
  emCommandStroke: "outline of the above",
  emEventFill: "categorical hue carries the block kind",
  emEventStroke: "outline of the above",
  emSwimlaneBackgroundOdd: "event-model swimlane banding, alongside the block palette above",
  emSwimlaneBackgroundStroke: "event-model swimlane banding, alongside the block palette above",
};

/** The `--color-*` custom property a table entry reads. */
export const cssVarOf = (token: string): string => `--color-${token}`;

/**
 * Resolve the table through a reader, which is what makes it testable: the caller supplies the lookup,
 * so this function has no DOM in it and the tests need no document.
 *
 * An entry whose token resolves empty is **dropped** rather than given a literal fallback. A literal is
 * the thing this table forbids, and a token absent at runtime means the stylesheet has not been applied
 * at all, in which case nothing on the page has its colours and one diagram is not the problem. What
 * keeps this unreachable in practice is `contrast.test.ts`, which asserts every token named here is
 * defined in both of `global.css`'s theme blocks — a typo fails a test rather than quietly degrading a
 * diagram to Mermaid's own palette.
 */
export function resolveDiagramColors(read: (cssVar: string) => string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [mermaidVar, { token }] of Object.entries(DIAGRAM_COLORS)) {
    const value = read(cssVarOf(token)).trim();
    if (value) out[mermaidVar] = value;
  }
  return out;
}

/** The reader the application uses: the custom properties actually applied to `root`. */
export const cssVarReader =
  (root: Element) =>
  (cssVar: string): string =>
    getComputedStyle(root).getPropertyValue(cssVar);
