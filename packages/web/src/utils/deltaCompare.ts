/**
 * What each requirement under a delta's `## MODIFIED Requirements` changes, compared with the requirement of
 * the same name in the main spec — the marks the change's Specs tab draws (issue #71).
 *
 * Structure is read the way OpenSpec reads it, not the way Markdown renders it: OpenSpec's `archive` is what
 * will apply this delta, so a mark must never disagree with it. The rules are OpenSpec 2.1.0's
 * (`requirement-blocks.ts`, `requirement-text.ts`, `code-fence.ts`):
 * - lines inside fenced code blocks are never structure;
 * - a `## ` header starts a section; titles match case-insensitively, a closing `#` run removed;
 * - a requirement starts at `### Requirement:` and runs to the next one or the next `## ` — an ordinary
 *   `### Notes` stays inside it; its name is trimmed with a closing `#` run removed, matched case-sensitively;
 * - a scenario is any `#### ` header, not only `#### Scenario:`, and runs to the next `#### `; its name drops
 *   a closing `#` run and a leading `Scenario:` (any case);
 * - a main spec's requirements are read from its `## Requirements` section only.
 *
 * Marks are keyed by the 1-based line of the header they belong to in the delta source, because that is the
 * one thing the rendered heading still shares with the source: its text is what Markdown made of the line
 * (bold, escapes, entities and code spans all differ), and a mark matched by text would vanish silently.
 */

export type RequirementMark = "changed" | "same" | "renamed-only" | "not-in-current-spec";
export type ScenarioMark = "new" | "changed";

export interface DeltaMarks {
  /** Whether the delta has a requirement under `## MODIFIED Requirements` at all. */
  hasModified: boolean;
  /** Requirement header line → its mark. A requirement whose scenarios carry the news has none. */
  requirements: Map<number, RequirementMark>;
  /** Scenario header line → its mark. Unmarked scenarios equal their base. */
  scenarios: Map<number, ScenarioMark>;
  /** Requirement header line → names of base scenarios the modification no longer has. */
  dropped: Map<number, string[]>;
}

const REQUIREMENT_HEADER = /^###\s*Requirement:\s*(.+)\s*$/i;
const SECTION_HEADER = /^##\s+(.+)$/;
const REQUIREMENTS_SECTION = /^##\s+Requirements(?:[ \t]+#+)?\s*$/i;
const SCENARIO_HEADER = /^####\s+/;
const RENAME_FROM = /^\s*[-*+]?\s*FROM:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/;
const RENAME_TO = /^\s*[-*+]?\s*TO:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/;

/** A leading byte order mark goes and every line ending becomes `\n`, as OpenSpec's `normalizeLineEndings`. */
export function sourceLines(source: string): string[] {
  return source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
}

const stripClosingSequence = (title: string): string => title.replace(/[ \t]+#+[ \t]*$/, "").trim();

const scenarioName = (line: string): string =>
  line
    .replace(SCENARIO_HEADER, "")
    .replace(/[ \t]+#+[ \t]*$/, "")
    .replace(/^Scenario:\s*/i, "")
    .trim();

/** OpenSpec's fence mask: a ``` or ~~~ run opens; the same marker, at least as long, alone on a line closes. */
function fenceMask(lines: readonly string[]): boolean[] {
  const mask = new Array<boolean>(lines.length).fill(false);
  let open: { marker: string; length: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (!open) {
      const m = lines[i].match(/^\s*(`{3,}|~{3,})(.*)/);
      if (m && !(m[1][0] === "`" && m[2].includes("`"))) {
        open = { marker: m[1][0], length: m[1].length };
        mask[i] = true;
      }
      continue;
    }
    mask[i] = true;
    const close = lines[i].match(/^\s*(`{3,}|~{3,})\s*$/);
    if (close && close[1][0] === open.marker && close[1].length >= open.length) open = null;
  }
  return mask;
}

/** Text compared for equality: trailing whitespace and blank lines are not a change. */
const normalise = (lines: readonly string[]): string =>
  lines
    .map((l) => l.trimEnd())
    .filter((l) => l !== "")
    .join("\n");

interface Scenario {
  name: string;
  line: number;
  text: string;
}

interface Requirement {
  name: string;
  line: number;
  statement: string;
  scenarios: Scenario[];
}

interface Parsed {
  lines: string[];
  mask: boolean[];
}

function parse(source: string): Parsed {
  const lines = sourceLines(source);
  return { lines, mask: fenceMask(lines) };
}

/** `[start, end)` line ranges of every `## ` section whose title satisfies [match]. */
function sections(doc: Parsed, match: (title: string, line: string) => boolean): Array<[number, number]> {
  const heads: Array<{ index: number; take: boolean }> = [];
  doc.lines.forEach((line, i) => {
    if (doc.mask[i]) return;
    const m = line.match(SECTION_HEADER);
    if (m) heads.push({ index: i, take: match(stripClosingSequence(m[1]).toLowerCase(), line) });
  });
  return heads
    .map((h, k) => ({ ...h, end: heads[k + 1]?.index ?? doc.lines.length }))
    .filter((h) => h.take)
    .map((h) => [h.index + 1, h.end]);
}

function requirementsIn(doc: Parsed, [start, end]: [number, number]): Requirement[] {
  const heads: number[] = [];
  for (let i = start; i < end; i++) if (!doc.mask[i] && REQUIREMENT_HEADER.test(doc.lines[i])) heads.push(i);
  return heads.map((head, k) => {
    const blockEnd = heads[k + 1] ?? end;
    const scenarioHeads: number[] = [];
    for (let i = head + 1; i < blockEnd; i++) {
      if (!doc.mask[i] && SCENARIO_HEADER.test(doc.lines[i])) scenarioHeads.push(i);
    }
    const statementEnd = scenarioHeads[0] ?? blockEnd;
    return {
      name: stripClosingSequence(doc.lines[head].match(REQUIREMENT_HEADER)![1]),
      line: head + 1,
      statement: normalise(doc.lines.slice(head + 1, statementEnd)),
      scenarios: scenarioHeads.map((s, j) => ({
        name: scenarioName(doc.lines[s]),
        line: s + 1,
        text: normalise(doc.lines.slice(s + 1, scenarioHeads[j + 1] ?? blockEnd)),
      })),
    };
  });
}

/** RENAMED pairs as new name → old name. A line without a `### Requirement:` header is not a pair. */
function renames(doc: Parsed): Map<string, string> {
  const out = new Map<string, string>();
  for (const [start, end] of sections(doc, (t) => t === "renamed requirements")) {
    let from: string | null = null;
    for (let i = start; i < end; i++) {
      if (doc.mask[i]) continue;
      const f = doc.lines[i].match(RENAME_FROM);
      const t = doc.lines[i].match(RENAME_TO);
      if (f) from = stripClosingSequence(f[1]);
      else if (t && from !== null) {
        out.set(stripClosingSequence(t[1]), from);
        from = null;
      }
    }
  }
  return out;
}

/**
 * Pairs same-named scenarios k-th to k-th in document order, as OpenSpec's `diffScenarioNames` counts them:
 * returns, for each delta scenario, its base partner or null, and the base scenarios left unpaired.
 */
function pairScenarios(delta: readonly Scenario[], base: readonly Scenario[]) {
  const pool = new Map<string, Scenario[]>();
  for (const s of base) pool.set(s.name, [...(pool.get(s.name) ?? []), s]);
  const partners = delta.map((s) => pool.get(s.name)?.shift() ?? null);
  const paired = new Set(partners.filter((p): p is Scenario => p !== null));
  return { partners, unpaired: base.filter((s) => !paired.has(s)) };
}

export function compareModified(delta: string, base: string | null): DeltaMarks {
  const d = parse(delta);
  const modified = sections(d, (t) => t === "modified requirements").flatMap((range) => requirementsIn(d, range));
  const marks: DeltaMarks = {
    hasModified: modified.length > 0,
    requirements: new Map(),
    scenarios: new Map(),
    dropped: new Map(),
  };
  if (modified.length === 0) return marks;

  const baseRequirements = new Map<string, Requirement>();
  if (base !== null) {
    const b = parse(base);
    const range = sections(b, (_, line) => REQUIREMENTS_SECTION.test(line))[0];
    for (const r of range ? requirementsIn(b, range) : []) {
      if (!baseRequirements.has(r.name)) baseRequirements.set(r.name, r);
    }
  }
  const renamedFrom = renames(d);

  for (const req of modified) {
    // A rename looks the requirement up under its old name — unless that name is gone and the new one is
    // present, which is a rename already synced into the main spec; OpenSpec then treats it as applied.
    const oldName = renamedFrom.get(req.name);
    const viaRename = oldName !== undefined && baseRequirements.has(oldName);
    const current = viaRename ? baseRequirements.get(oldName) : baseRequirements.get(req.name);
    if (!current) {
      marks.requirements.set(req.line, "not-in-current-spec");
      continue;
    }

    const { partners, unpaired } = pairScenarios(req.scenarios, current.scenarios);
    req.scenarios.forEach((s, i) => {
      const partner = partners[i];
      if (partner === null) marks.scenarios.set(s.line, "new");
      else if (partner.text !== s.text) marks.scenarios.set(s.line, "changed");
    });
    if (unpaired.length > 0) marks.dropped.set(req.line, unpaired.map((s) => s.name));

    const statementChanged = req.statement !== current.statement;
    const sameScenarios =
      req.scenarios.length === current.scenarios.length &&
      req.scenarios.every((s, i) => s.name === current.scenarios[i].name && s.text === current.scenarios[i].text);
    if (statementChanged) marks.requirements.set(req.line, "changed");
    else if (sameScenarios) marks.requirements.set(req.line, viaRename ? "renamed-only" : "same");
  }
  return marks;
}
