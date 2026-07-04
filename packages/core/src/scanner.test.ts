import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseChangeYaml, readChange, scanOpenSpec } from "./scanner.js";

function mkRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spek-scanner-test-"));
}

function writeChange(
  repoDir: string,
  group: "active" | "archived",
  slug: string,
  yamlContent: string | null,
): void {
  const base =
    group === "active"
      ? path.join(repoDir, "openspec", "changes", slug)
      : path.join(repoDir, "openspec", "changes", "archive", slug);
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, "proposal.md"), "## Why\n");
  if (yamlContent !== null) {
    fs.writeFileSync(path.join(base, ".openspec.yaml"), yamlContent);
  }
}

test("parseChangeYaml: parses top-level key:value pairs", () => {
  const result = parseChangeYaml("schema: spec-driven\ncreated: 2026-04-20\n");
  assert.equal(result.schema, "spec-driven");
  assert.equal(result.created, "2026-04-20");
});

test("parseChangeYaml: ignores comments and blank lines", () => {
  const result = parseChangeYaml("# comment\n\ncreated: 2026-04-20\n");
  assert.equal(result.created, "2026-04-20");
});

test("scanOpenSpec: active change reads createdDate from .openspec.yaml", async () => {
  const repo = mkRepo();
  writeChange(repo, "active", "add-foo", "schema: spec-driven\ncreated: 2026-04-20\n");
  const result = await scanOpenSpec(repo);
  assert.equal(result.activeChanges.length, 1);
  assert.equal(result.activeChanges[0].createdDate, "2026-04-20");
  assert.equal(result.activeChanges[0].archivedDate, null);
});

test("scanOpenSpec: archived change derives archivedDate from folder name", async () => {
  const repo = mkRepo();
  writeChange(
    repo,
    "archived",
    "2026-02-22-fix-x",
    "schema: spec-driven\ncreated: 2026-02-14\n",
  );
  const result = await scanOpenSpec(repo);
  assert.equal(result.archivedChanges.length, 1);
  assert.equal(result.archivedChanges[0].createdDate, "2026-02-14");
  assert.equal(result.archivedChanges[0].archivedDate, "2026-02-22");
});

test("scanOpenSpec: missing .openspec.yaml yields null createdDate", async () => {
  const repo = mkRepo();
  writeChange(repo, "active", "no-yaml", null);
  const result = await scanOpenSpec(repo);
  assert.equal(result.activeChanges[0].createdDate, null);
});

test("scanOpenSpec: malformed created value yields null", async () => {
  const repo = mkRepo();
  writeChange(repo, "active", "bad-date", "created: not-a-date\n");
  const result = await scanOpenSpec(repo);
  assert.equal(result.activeChanges[0].createdDate, null);
});

test("scanOpenSpec: yaml without created key yields null", async () => {
  const repo = mkRepo();
  writeChange(repo, "active", "no-created", "schema: spec-driven\n");
  const result = await scanOpenSpec(repo);
  assert.equal(result.activeChanges[0].createdDate, null);
});

// 不 spawn 真的 openspec CLI 的 provider（測試隔離用）
const noOrder = () => null;

test("readChange: returns createdDate and archivedDate for archived change", async () => {
  const repo = mkRepo();
  writeChange(
    repo,
    "archived",
    "2026-02-22-fix-y",
    "schema: spec-driven\ncreated: 2026-02-14\n",
  );
  const detail = await readChange(repo, "2026-02-22-fix-y", noOrder);
  assert.ok(detail);
  assert.equal(detail.status, "archived");
  assert.equal(detail.createdDate, "2026-02-14");
  assert.equal(detail.archivedDate, "2026-02-22");
});

test("readChange: returns createdDate and null archivedDate for active change", async () => {
  const repo = mkRepo();
  writeChange(repo, "active", "add-bar", "schema: spec-driven\ncreated: 2026-04-20\n");
  const detail = await readChange(repo, "add-bar", noOrder);
  assert.ok(detail);
  assert.equal(detail.status, "active");
  assert.equal(detail.createdDate, "2026-04-20");
  assert.equal(detail.archivedDate, null);
});

test("readChange: attaches schemaOrder from the provider for an active change", async () => {
  const repo = mkRepo();
  const base = path.join(repo, "openspec", "changes", "bridge-change");
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, "proposal.md"), "## Why\n");
  fs.writeFileSync(path.join(base, "plan.md"), "plan\n");
  fs.writeFileSync(path.join(base, "brainstorm.md"), "raw\n");
  // 權威順序：brainstorm -> proposal -> plan（與 mtime 預設序無關）
  const provider = () => [
    { id: "brainstorm", outputPath: "brainstorm.md" },
    { id: "proposal", outputPath: "proposal.md" },
    { id: "plan", outputPath: "plan.md" },
  ];
  const detail = await readChange(repo, "bridge-change", provider);
  assert.ok(detail);
  assert.deepEqual(detail.schemaOrder, ["brainstorm", "proposal", "plan"]);
});

test("readChange: awaits an async (Promise) provider for an active change", async () => {
  const repo = mkRepo();
  const base = path.join(repo, "openspec", "changes", "bridge-change");
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, "proposal.md"), "## Why\n");
  fs.writeFileSync(path.join(base, "plan.md"), "plan\n");
  // 預設 CLI provider 是非同步的：readChange 必須 await Promise 結果
  const provider = () =>
    Promise.resolve([
      { id: "plan", outputPath: "plan.md" },
      { id: "proposal", outputPath: "proposal.md" },
    ]);
  const detail = await readChange(repo, "bridge-change", provider);
  assert.ok(detail);
  assert.deepEqual(detail.schemaOrder, ["plan", "proposal"]);
});

test("readChange: schemaOrder is undefined when the provider returns null", async () => {
  const repo = mkRepo();
  writeChange(repo, "active", "add-bar", "schema: spec-driven\n");
  const detail = await readChange(repo, "add-bar", noOrder);
  assert.ok(detail);
  assert.equal(detail.schemaOrder, undefined);
});

test("readChange: an archived change never consults the provider", async () => {
  const repo = mkRepo();
  writeChange(repo, "archived", "2026-02-22-fix-y", "schema: spec-driven\n");
  let called = 0;
  const provider = () => {
    called += 1;
    return [{ id: "proposal", outputPath: "proposal.md" }];
  };
  const detail = await readChange(repo, "2026-02-22-fix-y", provider);
  assert.ok(detail);
  assert.equal(called, 0);
  assert.equal(detail.schemaOrder, undefined);
});
