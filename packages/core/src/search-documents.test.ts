import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectSearchDocuments } from "./search-documents.js";
import { changeSearchDocuments } from "./search.js";
import { readChange } from "./scanner.js";

/** This repository, which is the only real corpus the tests have. */
const REPO = fileURLToPath(new URL("../../../", import.meta.url));

function tempRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spek-search-"));
}

test("the delta specs tree contributes no document", () => {
  const docs = collectSearchDocuments(REPO);
  assert.ok(docs.length > 0, "this repository should produce documents");
  for (const doc of docs) {
    assert.ok(
      !doc.file.includes("/") && !doc.file.includes("\\"),
      `expected a root filename, got ${doc.file}`,
    );
  }
  // A delta spec's body would arrive as a document whose file is spec.md but whose type is change.
  assert.equal(
    docs.filter((d) => d.type === "change" && d.file === "spec.md").length,
    0,
  );
});

test("archived changes contribute documents, marked archived", () => {
  const docs = collectSearchDocuments(REPO);
  const archived = docs.filter((d) => d.status === "archived");
  assert.ok(archived.length > 0, "this repository has archived changes");
});

// Deliberately over a temp repo rather than this one: whether spek has an active change depends on where
// its own work happens to be, and a test that assumes one fails the moment the last change is archived.
test("active and archived changes are distinguished", () => {
  const repo = tempRepo();
  const changes = path.join(repo, "openspec", "changes");
  fs.mkdirSync(path.join(changes, "in-flight"), { recursive: true });
  fs.writeFileSync(path.join(changes, "in-flight", "proposal.md"), "current");
  fs.mkdirSync(path.join(changes, "archive", "2026-01-01-done"), { recursive: true });
  fs.writeFileSync(path.join(changes, "archive", "2026-01-01-done", "proposal.md"), "past");

  const docs = collectSearchDocuments(repo);
  assert.deepEqual(
    docs.map((d) => `${d.name}:${d.status}`),
    ["in-flight:active", "2026-01-01-done:archived"],
  );
  fs.rmSync(repo, { recursive: true, force: true });
});

test("specs contribute one document each", () => {
  const docs = collectSearchDocuments(REPO).filter((d) => d.type === "spec");
  const topics = new Set(docs.map((d) => d.name));
  assert.equal(topics.size, docs.length, "one document per topic");
  assert.ok(docs.every((d) => d.file === "spec.md"));
});

test("dot entries contribute nothing", () => {
  const repo = tempRepo();
  const changes = path.join(repo, "openspec", "changes");
  fs.mkdirSync(path.join(changes, ".scratch"), { recursive: true });
  fs.writeFileSync(path.join(changes, ".scratch", "proposal.md"), "hidden");
  fs.mkdirSync(path.join(changes, "real"), { recursive: true });
  fs.writeFileSync(path.join(changes, "real", "proposal.md"), "visible");
  fs.writeFileSync(path.join(changes, "real", ".draft.md"), "hidden too");

  const docs = collectSearchDocuments(repo);
  assert.deepEqual(
    docs.map((d) => `${d.name}/${d.file}`),
    ["real/proposal.md"],
  );
  fs.rmSync(repo, { recursive: true, force: true });
});

test("an empty artifact file still contributes a document", () => {
  const repo = tempRepo();
  const change = path.join(repo, "openspec", "changes", "c");
  fs.mkdirSync(change, { recursive: true });
  fs.writeFileSync(path.join(change, "notes.md"), "");
  const docs = collectSearchDocuments(repo);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].text, "");
  fs.rmSync(repo, { recursive: true, force: true });
});

// The seam this design creates: a filesystem holds files and an embedded payload holds records, so the
// corpus has two producers. Nothing but this test keeps them equal.
test("both document producers agree over this repository's changes", async () => {
  const fromFiles = collectSearchDocuments(REPO).filter((d) => d.type === "change");
  const bySlug = new Map<string, typeof fromFiles>();
  for (const doc of fromFiles) {
    const group = bySlug.get(doc.name);
    if (group) group.push(doc);
    else bySlug.set(doc.name, [doc]);
  }

  assert.ok(bySlug.size > 0);
  for (const [slug, expected] of bySlug) {
    // No CLI: the schema order does not affect the corpus, and spawning per change would be slow.
    const detail = await readChange(REPO, slug, async () => null);
    assert.ok(detail, `readChange should find ${slug}`);
    const fromRecords = changeSearchDocuments(detail);
    assert.deepEqual(
      fromRecords.map((d) => d.file),
      expected.map((d) => d.file),
      `${slug}: document order and filenames must agree`,
    );
    assert.deepEqual(
      fromRecords.map((d) => d.text),
      expected.map((d) => d.text),
      `${slug}: document text must agree`,
    );
  }
});

test("a root diagram file contributes exactly one document, holding its source text", () => {
  const repo = tempRepo();
  const change = path.join(repo, "openspec", "changes", "c");
  fs.mkdirSync(change, { recursive: true });
  fs.writeFileSync(path.join(change, "proposal.md"), "why");
  fs.writeFileSync(path.join(change, "flow.mmd"), "graph TD\n  Ingest-->Normalise\n");
  fs.writeFileSync(path.join(change, "seq.mermaid"), "sequenceDiagram\n");
  fs.mkdirSync(path.join(change, "nested"), { recursive: true });
  fs.writeFileSync(path.join(change, "nested", "deep.mmd"), "graph TD\n");
  fs.writeFileSync(path.join(change, ".draft.mmd"), "graph TD\n");

  const docs = collectSearchDocuments(repo);
  assert.deepEqual(
    docs.map((d) => d.file),
    // markdown bucket first, then the extension-keeping kinds by filename — the rootArtifacts order
    ["proposal.md", "flow.mmd", "seq.mermaid"],
  );
  assert.equal(
    docs.find((d) => d.file === "flow.mmd")!.text,
    "graph TD\n  Ingest-->Normalise\n",
  );
  fs.rmSync(repo, { recursive: true, force: true });
});

// The two producers partition by kind independently, so a new kind can land in one bucket on the
// filesystem side and another in the record side without either being wrong on its own.
test("both producers put a diagram artifact in the same position", async () => {
  const repo = tempRepo();
  const change = path.join(repo, "openspec", "changes", "c");
  fs.mkdirSync(change, { recursive: true });
  fs.writeFileSync(path.join(change, "proposal.md"), "why");
  fs.writeFileSync(path.join(change, "asyncapi.yaml"), "asyncapi: 3.0.0\n");
  fs.writeFileSync(path.join(change, "flow.mmd"), "graph TD\n");

  const fromFiles = collectSearchDocuments(repo);
  const detail = await readChange(repo, "c", async () => null);
  assert.ok(detail);
  const fromRecords = changeSearchDocuments(detail);
  assert.deepEqual(fromRecords.map((d) => d.file), fromFiles.map((d) => d.file));
  assert.deepEqual(fromRecords.map((d) => d.text), fromFiles.map((d) => d.text));
  fs.rmSync(repo, { recursive: true, force: true });
});
