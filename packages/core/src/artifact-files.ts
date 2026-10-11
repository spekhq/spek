import fs from "node:fs";
import path from "node:path";
import { discoverSpecFiles, hasSpecFiles } from "./spec-files.js";

/**
 * The filesystem view of one change directory: which files are artifacts, their kinds, their names,
 * and their mtimes. Everything here reads directory entries and stats only. It does not read file
 * content. discoverArtifacts in artifact-discovery.ts builds the ChangeArtifact objects on top of this list.
 */

/** The root-level extensions of a data artifact. Exported so a file watcher can build the set of
 *  extensions worth reacting to (`.md` + these) from one source. Re-listing them would drift when a new
 *  data extension is added here. */
export const DATA_EXTENSIONS = [".yaml", ".yml", ".json"];

/** The root-level extensions of a diagram artifact. Exported for the same reason as DATA_EXTENSIONS: a
 *  file watcher builds the set of extensions worth reacting to from these two lists, not from a third
 *  copy that drifts when one is extended. A diagram is its own kind rather than another data extension —
 *  `data` means "show this file's text", `diagram` means "show what this file describes", and folding the
 *  two together makes the raw source the only rendering a diagram file can ever get. */
export const DIAGRAM_EXTENSIONS = [".mmd", ".mermaid"];

/** The kind of a root-level artifact file. specs is not here: it is a tree, not a root file. */
export type RootKind = "tasks" | "markdown" | "data" | "diagram";

const isTasksName = (n: string) => n === "tasks.md";
const isMarkdownName = (n: string) => n.endsWith(".md");
const isDataName = (n: string) => DATA_EXTENSIONS.some((ext) => n.endsWith(ext));
const isDiagramName = (n: string) => DIAGRAM_EXTENSIONS.some((ext) => n.endsWith(ext));

/**
 * The one classifier for root files. It returns the artifact kind of a root filename, or null if the
 * file is not an artifact. count, search, and discover all go through it, so a new root kind cannot slip
 * past one of them.
 */
function rootKind(nameLower: string): RootKind | null {
  if (isTasksName(nameLower)) return "tasks";
  if (isMarkdownName(nameLower)) return "markdown";
  if (isDataName(nameLower)) return "data";
  if (isDiagramName(nameLower)) return "diagram";
  return null;
}

/**
 * The filenames at the change root that pass `match`. It ignores dotfiles and directories, and sorts by
 * name. root-only and non-dotfile are the shared rules of every root-file listing, stated here once. It
 * does not descend: a file under a subdirectory is not an artifact.
 */
function listRootFiles(changePath: string, match: (nameLower: string) => boolean): string[] {
  if (!fs.existsSync(changePath)) return [];
  return fs
    .readdirSync(changePath, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith(".") && match(e.name.toLowerCase()))
    .map((e) => e.name)
    .sort();
}

/**
 * The root artifact files with their kinds, in id-dedup precedence: markdown and tasks first, then the
 * extension-keeping kinds (data and diagram). This order lets spec.md keep the id "spec" and pushes
 * spec.json to spec-2. discoverArtifacts builds
 * from this list. The display order is a separate mtime sort in discoverArtifacts. It does one directory
 * read and partitions the entries by kind.
 */
export function rootArtifacts(changePath: string): { file: string; kind: RootKind }[] {
  if (!fs.existsSync(changePath)) return [];
  // The file-only, non-dotfile rules are the same ones listRootFiles states. They are kept here because
  // this walk also needs each entry's kind. Carry {file, kind} through the partition, so the kind is
  // computed once and not recomputed behind a non-null assertion after the sort.
  const md: { file: string; kind: RootKind }[] = [];
  const data: { file: string; kind: RootKind }[] = [];
  for (const e of fs.readdirSync(changePath, { withFileTypes: true })) {
    if (!e.isFile() || e.name.startsWith(".")) continue;
    const kind = rootKind(e.name.toLowerCase());
    if (!kind) continue;
    // data and diagram share the second bucket: both keep their extension in the title, and both yield
    // the bare stem to a markdown file of the same name (flow.md keeps `flow`, flow.mmd becomes flow-2).
    (kind === "data" || kind === "diagram" ? data : md).push({ file: e.name, kind });
  }
  // Default string order per bucket (matches the prior `.sort()` on names), so spec.md still precedes
  // spec.yaml within data and the id-dedup precedence in discoverArtifacts is unchanged.
  const byName = (a: { file: string }, b: { file: string }) =>
    a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
  md.sort(byName);
  data.sort(byName);
  return [...md, ...data];
}

/**
 * The specs/ delta tree as a { topic, file } list, at any depth, sorted by topic in code-unit order.
 * It reads directory entries only. hasSpecsTree, specsMtime, and the spec content read in
 * discoverArtifacts all derive from the one walker in spec-files.ts.
 */
export function listSpecFiles(changePath: string): { topic: string; file: string }[] {
  return discoverSpecFiles(path.join(changePath, "specs"));
}

/** True if specs/ holds at least one spec. This is the changes-list hot path (countArtifacts, called
 *  per change during a scan), so it stops at the first hit rather than building the full list. */
function hasSpecsTree(changePath: string): boolean {
  return hasSpecFiles(path.join(changePath, "specs"));
}

/** The sort time of the specs artifact: the newest mtime of every spec.md file (0 if none). */
export function specsMtime(changePath: string): number {
  let newest = 0;
  for (const { file } of listSpecFiles(changePath)) {
    const m = fs.statSync(file).mtimeMs;
    if (m > newest) newest = m;
  }
  return newest;
}

/**
 * The root files that count as a searchable artifact (markdown, tasks, data, and diagram), sorted by
 * name. A diagram file is indexed as the text it holds, not as the picture drawn from it: the labels an
 * author writes into a diagram are frequently the only place a term appears. The
 * specs delta tree is not here: it shows in the Specs tab, but its content does not go into search.
 *
 * It is name-sorted across all kinds, which is *not* the corpus order — search builds its documents from
 * `rootArtifacts` (markdown and tasks before data) via `collectSearchDocuments`, so that a change matched
 * by name alone is previewed from prose rather than from raw YAML. This function no longer has an in-repo
 * caller; it stays because it is a published export of @spekjs/core.
 */
export function listChangeArtifactFiles(changePath: string): string[] {
  return rootArtifacts(changePath)
    .map((a) => a.file)
    .sort();
}

/**
 * The root markdown filenames of a change (root *.md, including tasks.md). This is an existing published
 * export of @spekjs/core, kept for outside consumers. The app uses listChangeArtifactFiles instead.
 */
export function listChangeMarkdownFiles(changePath: string): string[] {
  return listRootFiles(changePath, isMarkdownName);
}

/**
 * The artifact count (the root artifact files, plus 1 for a non-empty specs tree). ChangeInfo uses it on
 * the changes-list hot path. It reads no content, and returns 0 for a missing changePath.
 */
export function countArtifacts(changePath: string): number {
  return rootArtifacts(changePath).length + (hasSpecsTree(changePath) ? 1 : 0);
}

/**
 * The newest mtime of the change directory: the maximum over the root artifact files and the specs tree.
 * The cross-worktree election uses it to find which copy was edited last.
 */
export function changeDirMtime(changePath: string): number {
  let newest = specsMtime(changePath);
  for (const { file } of rootArtifacts(changePath)) {
    const m = fs.statSync(path.join(changePath, file)).mtimeMs;
    if (m > newest) newest = m;
  }
  return newest;
}
