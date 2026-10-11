import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGraphData,
  findRelatedChanges,
  readChange,
  readSpec,
  readSpecAtChange,
  scanOpenSpec,
} from "./scanner.js";
import { changeDirMtime, countArtifacts } from "./artifact-files.js";
import { discoverSpecFiles, resolveSpecFile } from "./spec-files.js";
import { collectSearchDocuments, searchRepository } from "./search-documents.js";

// Shared with the Kotlin tests: test-fixtures/nested-specs is one corpus both scanners must agree on.
const FIXTURE = fileURLToPath(new URL("../../../test-fixtures/nested-specs", import.meta.url));
const noOrder = async () => null;

// The answer both hosts are held to; NestedSpecsTest.kt reads the same file.
const EXPECTED = JSON.parse(fs.readFileSync(path.join(FIXTURE, "expected.json"), "utf-8")) as {
  topics: string[];
  historyCounts: Record<string, number>;
  edges: [string, string][];
  searchSpecTopics: Record<string, string[]>;
};
const FIXTURE_TOPICS = EXPECTED.topics;

test("fixture: every nested spec is a topic; the root spec.md and dot-directories are not", async () => {
  const scan = await scanOpenSpec(FIXTURE);
  assert.deepEqual(
    scan.specs.map((s) => s.topic),
    FIXTURE_TOPICS,
  );
  assert.ok(scan.specs.every((s) => s.path.endsWith(path.join(...s.topic.split("/"), "spec.md"))));
});

test("fixture: history counts follow the exact nested topic", async () => {
  const scan = await scanOpenSpec(FIXTURE);
  const counts = Object.fromEntries(scan.specs.map((s) => [s.topic, s.historyCount]));
  assert.deepEqual(counts, EXPECTED.historyCounts);
});

test("fixture: parent, child, and same-basename histories stay separate", async () => {
  assert.deepEqual(findRelatedChanges(FIXTURE, "contracts/pagination"), ["2026-01-10-add-pagination"]);
  assert.deepEqual(findRelatedChanges(FIXTURE, "contracts/pagination/streaming-search"), ["add-streaming-search"]);
  assert.deepEqual(findRelatedChanges(FIXTURE, "guides/pagination"), ["2026-02-01-add-guides"]);
  const child = await readSpec(FIXTURE, "contracts/pagination/streaming-search");
  assert.deepEqual(
    child?.history.map((h) => [h.slug, h.status]),
    [["add-streaming-search", "active"]],
  );
});

test("fixture: a version read uses the exact topic and never substitutes a parent", () => {
  assert.match(
    readSpecAtChange(FIXTURE, "contracts/pagination/streaming-search", "add-streaming-search")?.content ?? "",
    /DELTAONLYTERM/,
  );
  assert.match(readSpecAtChange(FIXTURE, "contracts/pagination", "2026-01-10-add-pagination")?.content ?? "", /paginate/);
  assert.equal(readSpecAtChange(FIXTURE, "contracts/pagination/streaming-search", "2026-01-10-add-pagination"), null);
  assert.equal(readSpecAtChange(FIXTURE, "contracts/pagination", "add-streaming-search"), null);
  assert.equal(readSpecAtChange(FIXTURE, "contracts/pagination", "../add-streaming-search"), null);
  assert.equal(readSpecAtChange(FIXTURE, "contracts/pagination", "archive"), null);
});

test("fixture: a nested delta is the change's Specs artifact, counted once", async () => {
  const change = await readChange(FIXTURE, "add-streaming-search", noOrder);
  const specs = change?.artifacts.find((a) => a.kind === "specs");
  assert.deepEqual(specs?.specs?.map((s) => s.topic), ["contracts/pagination/streaming-search"]);
  assert.equal(countArtifacts(path.join(FIXTURE, "openspec", "changes", "add-streaming-search")), 2);
  const archived = await readChange(FIXTURE, "2026-01-10-add-pagination", noOrder);
  assert.deepEqual(
    archived?.artifacts.find((a) => a.kind === "specs")?.specs?.map((s) => s.topic),
    ["contracts/pagination"],
  );
});

test("fixture: graph edges target the exact nested spec node", () => {
  const graph = buildGraphData(FIXTURE);
  assert.deepEqual(
    graph.nodes.filter((n) => n.type === "spec").map((n) => n.id),
    FIXTURE_TOPICS.map((t) => `spec:${t}`),
  );
  assert.deepEqual(
    graph.edges.map((e) => [e.source, e.target]).sort(),
    EXPECTED.edges,
  );
  const parent = graph.nodes.find((n) => n.id === "spec:contracts/pagination");
  assert.equal(parent?.historyCount, 1);
});

test("fixture: nested main specs are distinct search documents; nested deltas are not searched", () => {
  const specDocs = collectSearchDocuments(FIXTURE).filter((d) => d.type === "spec");
  assert.deepEqual(
    specDocs.map((d) => d.name),
    FIXTURE_TOPICS,
  );
  // `pagination`: the child's name also contains the term, so it matches by name; the two same-basename
  // specs must still come back as two results, each under its own full topic. `DELTAONLYTERM` appears
  // only in a nested delta, which is not indexed.
  for (const [query, topics] of Object.entries(EXPECTED.searchSpecTopics)) {
    const results = searchRepository(FIXTURE, query);
    assert.deepEqual(results.filter((r) => r.type === "spec").map((r) => r.topic), topics, query);
  }
  assert.deepEqual(searchRepository(FIXTURE, "DELTAONLYTERM"), []);
});

test("fixture: malformed and hidden topics read as absent", async () => {
  for (const topic of ["../specs/auth", "contracts//pagination", "/auth", "auth/", "auth\n", ".drafts/hidden", ""]) {
    assert.equal(await readSpec(FIXTURE, topic), null, JSON.stringify(topic));
    assert.deepEqual(findRelatedChanges(FIXTURE, topic), [], JSON.stringify(topic));
  }
  assert.equal(await readSpec(FIXTURE, path.join(FIXTURE, "openspec", "specs", "auth")), null);
});

// --- Cases built in a temp dir -------------------------------------------------------------------

function tempRepo(files: Record<string, string>): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "spek-nested-test-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(repo, "openspec", ...rel.split("/"));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return repo;
}

/** Symlinks are created at runtime, not committed: git's `core.symlinks` and Windows' Developer Mode
 *  decide whether a checkout or a test can make one. Returns false (and skips) when it can't. */
function trySymlink(t: TestContext, target: string, link: string, type: "file" | "dir"): boolean {
  try {
    fs.symlinkSync(target, link, type);
    return true;
  } catch (e) {
    t.skip(`cannot create a ${type} symlink here (${(e as NodeJS.ErrnoException).code}); on Windows enable Developer Mode`);
    return false;
  }
}

test("topics order by code unit, not by locale", async () => {
  const repo = tempRepo({ "specs/ab/spec.md": "x", "specs/a/c/spec.md": "x", "specs/a-b/spec.md": "x", "specs/a/spec.md": "x" });
  assert.deepEqual(
    (await scanOpenSpec(repo)).specs.map((s) => s.topic),
    ["a", "a-b", "a/c", "ab"],
  );
});

test("a nested delta's mtime is the change's mtime", () => {
  const repo = tempRepo({
    "changes/c/proposal.md": "x",
    "changes/c/specs/contracts/pagination/spec.md": "x",
  });
  const change = path.join(repo, "openspec", "changes", "c");
  // Whole seconds: a millisecond time comes back through the float `mtimeMs` as e.g. `…546.999`.
  const future = Math.floor(Date.now() / 1000) + 86_400;
  fs.utimesSync(path.join(change, "specs", "contracts", "pagination", "spec.md"), future, future);
  assert.equal(changeDirMtime(change), future * 1000);
  assert.equal(countArtifacts(change), 2);
});

test("symlinked spec.md inside its capability is discovered", (t) => {
  const repo = tempRepo({ "specs/auth/real.md": "x" });
  const specs = path.join(repo, "openspec", "specs");
  if (!trySymlink(t, path.join(specs, "auth", "real.md"), path.join(specs, "auth", "spec.md"), "file")) return;
  assert.deepEqual(discoverSpecFiles(specs).map((s) => s.topic), ["auth"]);
});

test("symlinked spec.md targeting elsewhere in specs is discovered and readable", async (t) => {
  const repo = tempRepo({ "specs/shared/auth.md": "SHARED", "specs/auth/.keep": "" });
  const specs = path.join(repo, "openspec", "specs");
  if (!trySymlink(t, path.join(specs, "shared", "auth.md"), path.join(specs, "auth", "spec.md"), "file")) return;
  assert.deepEqual(discoverSpecFiles(specs).map((s) => s.topic), ["auth"]);
  assert.equal((await readSpec(repo, "auth"))?.content, "SHARED");
});

test("symlinked spec.md escaping specs is rejected and the scan goes on", async (t) => {
  const repo = tempRepo({ "specs/ok/spec.md": "x", "specs/auth/.keep": "", "secret.md": "SECRET" });
  const specs = path.join(repo, "openspec", "specs");
  if (!trySymlink(t, path.join(repo, "openspec", "secret.md"), path.join(specs, "auth", "spec.md"), "file")) return;
  assert.deepEqual((await scanOpenSpec(repo)).specs.map((s) => s.topic), ["ok"]);
  assert.equal(await readSpec(repo, "auth"), null);
});

test("a dangling spec.md link is skipped", (t) => {
  const repo = tempRepo({ "specs/auth/.keep": "" });
  const specs = path.join(repo, "openspec", "specs");
  if (!trySymlink(t, path.join(specs, "auth", "gone.md"), path.join(specs, "auth", "spec.md"), "file")) return;
  assert.deepEqual(discoverSpecFiles(specs), []);
});

test("a symlinked directory is not followed, and a topic through it is not readable", async (t) => {
  const repo = tempRepo({ "specs/contracts/pagination/spec.md": "x", "vendor/api/spec.md": "x" });
  const specs = path.join(repo, "openspec", "specs");
  if (!trySymlink(t, path.join(repo, "openspec", "vendor"), path.join(specs, "vendor"), "dir")) return;
  if (!trySymlink(t, path.join(specs, "contracts"), path.join(specs, "alias"), "dir")) return;
  assert.deepEqual((await scanOpenSpec(repo)).specs.map((s) => s.topic), ["contracts/pagination"]);
  assert.equal(await readSpec(repo, "alias/pagination"), null);
  assert.equal(await readSpec(repo, "vendor/api"), null);
  assert.ok(await readSpec(repo, "contracts/pagination"));
});

// Linux is case-sensitive, so a case-insensitive lookup (macOS, Windows) is simulated: lstat answers for
// a spelling the directory does not hold, the way those filesystems do. Discovery lists names as stored.
function aliasingLstat(t: TestContext, specs: string, alias: (segment: string) => string): void {
  const real = fs.lstatSync;
  t.mock.method(fs, "lstatSync", (p: fs.PathLike, ...rest: unknown[]) => {
    const rel = path.relative(specs, String(p));
    const target = rel.startsWith("..") ? String(p) : path.join(specs, ...rel.split(path.sep).map(alias));
    return (real as (...a: unknown[]) => fs.Stats)(target, ...rest);
  });
}

for (const [fsName, alias, spellings] of [
  ["case-insensitive", (s: string) => s.toLowerCase(), ["AUTH", "Auth"]],
  ["Windows trailing-dot", (s: string) => s.replace(/\.+$/, ""), ["auth.", "auth.."]],
] as const) {
  test(`on a ${fsName} filesystem, only the spelling discovery lists resolves`, (t) => {
    const repo = tempRepo({ "specs/auth/spec.md": "x" });
    const specs = path.join(repo, "openspec", "specs");
    aliasingLstat(t, specs, alias);
    assert.deepEqual(discoverSpecFiles(specs).map((s) => s.topic), ["auth"]);
    assert.ok(resolveSpecFile(specs, "auth"));
    for (const spelling of spellings) assert.equal(resolveSpecFile(specs, spelling), null, spelling);
  });
}

test("on a case-insensitive filesystem, a differently cased spec.md is not a spec", (t) => {
  const repo = tempRepo({ "specs/auth/Spec.md": "x" });
  const specs = path.join(repo, "openspec", "specs");
  aliasingLstat(t, specs, (s) => (s === "spec.md" ? "Spec.md" : s));
  assert.deepEqual(discoverSpecFiles(specs), []);
  assert.equal(resolveSpecFile(specs, "auth"), null);
});
