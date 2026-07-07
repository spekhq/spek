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

test("parseChangeYaml: CRLF line endings do not leave trailing \\r on values", () => {
  const result = parseChangeYaml("schema: spec-driven\r\ncreated: 2026-07-05\r\n");
  assert.equal(result.schema, "spec-driven");
  assert.equal(result.created, "2026-07-05");
});

test("scanOpenSpec: CRLF .openspec.yaml still reads createdDate", async () => {
  const repo = mkRepo();
  writeChange(repo, "active", "crlf-foo", "schema: spec-driven\r\ncreated: 2026-07-05\r\n");
  const result = await scanOpenSpec(repo);
  assert.equal(result.activeChanges.length, 1);
  assert.equal(result.activeChanges[0].createdDate, "2026-07-05");
});

test("scanOpenSpec: LF .openspec.yaml still reads createdDate (regression guard)", async () => {
  const repo = mkRepo();
  writeChange(repo, "active", "lf-foo", "schema: spec-driven\ncreated: 2026-07-05\n");
  const result = await scanOpenSpec(repo);
  assert.equal(result.activeChanges.length, 1);
  assert.equal(result.activeChanges[0].createdDate, "2026-07-05");
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

test("readChange: returns createdDate and archivedDate for archived change", () => {
  const repo = mkRepo();
  writeChange(
    repo,
    "archived",
    "2026-02-22-fix-y",
    "schema: spec-driven\ncreated: 2026-02-14\n",
  );
  const detail = readChange(repo, "2026-02-22-fix-y");
  assert.ok(detail);
  assert.equal(detail.status, "archived");
  assert.equal(detail.createdDate, "2026-02-14");
  assert.equal(detail.archivedDate, "2026-02-22");
});

test("readChange: returns createdDate and null archivedDate for active change", () => {
  const repo = mkRepo();
  writeChange(repo, "active", "add-bar", "schema: spec-driven\ncreated: 2026-04-20\n");
  const detail = readChange(repo, "add-bar");
  assert.ok(detail);
  assert.equal(detail.status, "active");
  assert.equal(detail.createdDate, "2026-04-20");
  assert.equal(detail.archivedDate, null);
});
