// The search rule: what a query matches, which document answers it, and in what order.
//
// spek ships four search surfaces — the web server, the VS Code host, the IntelliJ server and the static
// build's StaticAdapter — and before this module they held four implementations that disagreed about the
// corpus, the match test, the result count and the snippet. Everything they can share lives here; Kotlin
// mirrors it for the IntelliJ host, and the two are held together by test-fixtures/search/.
//
// Pure logic with no runtime import — the type imports erase — so it ships as the `@spekjs/core/search`
// subpath and can be value-imported from a browser bundle, which is what lets the static build run the
// same rule as a host that reads files. Obtaining the documents is the one part that cannot be shared: a
// filesystem holds files and an embedded payload holds records, so there are two producers (the Node one
// lives on the package index) and a test pins them against each other.

import type { ChangeArtifact, ChangeDetail, SearchResult } from "./types.js";

export interface SearchDocument {
  type: "spec" | "change";
  /** The spec topic or the change slug. */
  name: string;
  /** The source filename — a change's root file, or `spec.md` for a spec. */
  file: string;
  text: string;
  /** Changes only; carried onto the result so a reader can tell archived content apart. */
  status?: "active" | "archived";
}

/** Snippet extent either side of the match, in UTF-16 code units. */
const SNIPPET_RADIUS = 100;
/** Cap for the head-of-document snippet a name-only match gets. */
const HEAD_SNIPPET = 200;
const ELLIPSIS = "...";

/**
 * Case folding, applied one UTF-16 code unit at a time and truncated to one unit.
 *
 * Deliberately not `text.toLowerCase()` over the whole string, for two reasons that both matter here:
 *
 *  - **It is length-preserving**, so an index into the folded text is the same index into the original.
 *    Snippets are cut from the original, and a fold that changes length silently shifts every snippet
 *    after it. U+0130 is the case that shows it: whole-string `toLowerCase` expands it to two code units.
 *  - **The two runtimes agree on it.** Whole-string folding diverges between JavaScript and Java on
 *    exactly the interesting characters — U+00DF folds to `ss` in JS and stays put in Java, U+0130
 *    expands in JS and collapses to `i` in Java. Per-code-unit folding is `Character.toLowerCase` on both
 *    sides.
 *
 * The guarantee this buys is stated in the spec as exact for ASCII and best-effort beyond it: an astral
 * character cannot fold at all, since neither surrogate half carries a mapping.
 */
function fold(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const lower = text[i].toLowerCase();
    out += lower.length === 1 ? lower : lower[0];
  }
  return out;
}

/** `-` and `_` runs to single spaces: the form a slug or topic is *displayed* in. */
function humanise(name: string): string {
  return name.replace(/[-_]+/g, " ");
}

/**
 * UTF-16 code-unit order. Never `localeCompare`: ICU collation weakens punctuation, so `spec-diff` and
 * `specdiff` order differently under it, and Kotlin's `sortedBy` would not agree.
 */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * A change slug's date prefix and description. `2026-09-10-add-oauth` is `{date, "add oauth"}`; a slug
 * with no prefix — every active change, since the date is added at archive — keeps its whole name.
 *
 * It lives here rather than in scanner.ts because a result's title is part of the search rule and the
 * static build has no filesystem to reach the scanner through.
 */
export function parseSlug(slug: string): { date: string | null; description: string } {
  const match = slug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (match) return { date: match[1], description: humanise(match[2]) };
  return { date: null, description: humanise(slug) };
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/** The snippet around a match, or the head of the document when there is no match to centre on. */
function snippet(text: string, at: number, length: number): string {
  if (at < 0) {
    const head = text.slice(0, HEAD_SNIPPET);
    return head.length < text.length ? head + ELLIPSIS : head;
  }
  let start = Math.max(0, at - SNIPPET_RADIUS);
  let end = Math.min(text.length, at + length + SNIPPET_RADIUS);
  // Never cut between a surrogate pair: the half left behind is not a character.
  if (start > 0 && isLowSurrogate(text.charCodeAt(start))) start += 1;
  if (end < text.length && isLowSurrogate(text.charCodeAt(end))) end -= 1;
  return (start > 0 ? ELLIPSIS : "") + text.slice(start, end) + (end < text.length ? ELLIPSIS : "");
}

/**
 * Specs by topic, then active changes by slug, then archived changes by slug **descending**.
 *
 * Archived slugs carry a `YYYY-MM-DD-` prefix and active ones do not, so descending puts the most recently
 * archived first — the direction every other list in spek sorts. Ascending would make search the one view
 * that leads with the oldest thing it holds.
 */
function compareResults(a: SearchResult, b: SearchResult): number {
  const rank = (r: SearchResult) => (r.type === "spec" ? 0 : r.status === "archived" ? 2 : 1);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  const na = a.topic ?? a.slug ?? "";
  const nb = b.topic ?? b.slug ?? "";
  return ra === 2 ? byCodeUnit(nb, na) : byCodeUnit(na, nb);
}

/**
 * Run a query over documents.
 *
 * A document matches when its text contains the query, folded; a spec or change also matches on its name
 * or on the humanised form of that name — the form a result card displays, so a query copied off a result
 * finds it again.
 *
 * Each spec and change yields **one** result, taken from the first of its documents whose *text* contains
 * the query. Only when none does — a name match alone — does the first document supply it. Taking the
 * first document that matches by any test is the subtle wrong version: a name match makes every document
 * of that change match, so a real occurrence further down would be discarded in favour of a snippet
 * containing nothing the reader typed.
 */
export function searchDocuments(documents: SearchDocument[], query: string): SearchResult[] {
  const trimmed = query.trim();
  const q = fold(trimmed);
  if (!q) return [];

  const groups = new Map<string, SearchDocument[]>();
  for (const doc of documents) {
    const key = `${doc.type} ${doc.name}`;
    const group = groups.get(key);
    if (group) group.push(doc);
    else groups.set(key, [doc]);
  }

  const results: SearchResult[] = [];
  for (const docs of groups.values()) {
    const { name, type, status } = docs[0];
    let hit: { doc: SearchDocument; at: number } | null = null;
    for (const doc of docs) {
      const at = fold(doc.text).indexOf(q);
      if (at >= 0) {
        hit = { doc, at };
        break;
      }
    }
    if (!hit) {
      if (!fold(name).includes(q) && !fold(humanise(name)).includes(q)) continue;
      hit = { doc: docs[0], at: -1 };
    }
    results.push({
      type,
      title: type === "change" ? parseSlug(name).description : name,
      topic: type === "spec" ? name : undefined,
      slug: type === "change" ? name : undefined,
      status,
      file: hit.doc.file,
      context: snippet(hit.doc.text, hit.at, trimmed.length),
    });
  }

  return results.sort(compareResults);
}

/** One document per spec. */
export function specSearchDocument(topic: string, content: string): SearchDocument {
  return { type: "spec", name: topic, file: "spec.md", text: content };
}

/**
 * A change's documents, from an already-loaded `ChangeDetail` — the producer a host without a filesystem
 * uses. It must agree with the Node producer document for document; the cross-producer test pins that.
 *
 * The `specs` delta artifact is skipped: its content is the delta of a main spec that is itself indexed,
 * so indexing it lists the same text under two names.
 *
 * The two buckets mirror `rootArtifacts`' partition exactly — markdown and tasks first, then the kinds
 * that keep their extension (data and diagram) — because that partition is what decides document order
 * on the filesystem side, and the two producers must agree document for document. A diagram contributes
 * the text it holds, not the picture drawn from it: its labels are ordinary text in the file, and a rule
 * that matched the drawing could not be the same rule on a host that never draws.
 */
export function changeSearchDocuments(detail: ChangeDetail): SearchDocument[] {
  const markdown: ChangeArtifact[] = [];
  const data: ChangeArtifact[] = [];
  for (const artifact of detail.artifacts) {
    if (artifact.kind === "specs") continue;
    const keepsExtension = artifact.kind === "data" || artifact.kind === "diagram";
    (keepsExtension ? data : markdown).push(artifact);
  }
  const byFile = (a: ChangeArtifact, b: ChangeArtifact) => byCodeUnit(a.file ?? "", b.file ?? "");
  markdown.sort(byFile);
  data.sort(byFile);
  return [...markdown, ...data].map((artifact) => ({
    type: "change" as const,
    name: detail.slug,
    file: artifact.file ?? artifact.id,
    text: artifact.content ?? "",
    status: detail.status,
  }));
}
