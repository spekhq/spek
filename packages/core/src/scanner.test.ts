import { test, mock } from "node:test";
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
  fs.writeFileSync(path.join(base, ".openspec.yaml"), "schema: superpowers-bridge\n"); // 有 schema → provider 會被呼叫
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

test("readChange: passes the change's schema to the provider (for cache bucketing)", async () => {
  const repo = mkRepo();
  const base = path.join(repo, "openspec", "changes", "bridge-change");
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, ".openspec.yaml"), "schema: superpowers-bridge\n");
  fs.writeFileSync(path.join(base, "proposal.md"), "## Why\n");
  const seen: Array<{ repoRoot: string; slug: string; schema: string | null }> = [];
  const provider = (repoRoot: string, slug: string, schema: string | null) => {
    seen.push({ repoRoot, slug, schema });
    return null;
  };
  await readChange(repo, "bridge-change", provider);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].slug, "bridge-change");
  assert.equal(seen[0].schema, "superpowers-bridge");
});

test("readChange: no schema at all (no repo config, no change schema) → provider is NOT called", async () => {
  const repo = mkRepo(); // 無 openspec/config.yaml，故無 repo 預設 schema
  // change 自身也未宣告 schema → readChangeSchema 回 null → 根本沒有 `::spec-driven` 桶可查
  writeChange(repo, "active", "no-schema", "created: 2026-01-01\n");
  let calls = 0;
  const provider = () => {
    calls += 1;
    return [{ id: "proposal", outputPath: "proposal.md" }];
  };
  const detail = await readChange(repo, "no-schema", provider);
  assert.ok(detail);
  assert.equal(detail.schema, null); // 確認確實無 schema
  assert.equal(calls, 0); // 無 schema 即無權威順序可言 → 不查 CLI
  assert.equal(detail.schemaOrder, undefined);
});

test('readChange: an empty-string schema (schema: "") is treated as no schema → provider NOT called', async () => {
  const repo = mkRepo();
  // schema: "" 經 cleanScalar 會產出空字串（非 null）；空 schema 名不是有效 schema，須等同無 schema
  writeChange(repo, "active", "empty-schema", 'schema: ""\ncreated: 2026-01-01\n');
  let calls = 0;
  const provider = () => {
    calls += 1;
    return [{ id: "proposal", outputPath: "proposal.md" }];
  };
  const detail = await readChange(repo, "empty-schema", provider);
  assert.ok(detail);
  assert.equal(detail.schema, ""); // 釘住：readChangeSchema 確實產出 ""（我們正防的 case）
  assert.equal(calls, 0); // 空 schema → 不查 CLI（否則會以 `${repo}::` 這種退化 key 污染快取）
  assert.equal(detail.schemaOrder, undefined);
});

test("readChange: an empty slug is not a change → returns null without calling the provider", async () => {
  const repo = mkRepo();
  fs.mkdirSync(path.join(repo, "openspec", "changes"), { recursive: true }); // 先建 openspec/ 再寫 config
  fs.writeFileSync(path.join(repo, "openspec", "config.yaml"), "schema: spec-driven\n"); // 有預設 schema
  let calls = 0;
  const provider = () => {
    calls += 1;
    return [{ id: "proposal", outputPath: "proposal.md" }];
  };
  // 空 slug 會讓 changePath 指向 changes/ 目錄本身（存在）；若不擋，會以 `${repo}::spec-driven`
  // 為 key 把 null 寫進真實 spec-driven change 共用的桶而污染之
  const detail = await readChange(repo, "", provider);
  assert.equal(detail, null);
  assert.equal(calls, 0);
});

test("readChange: two changes sharing a schema each map the authoritative order onto their own artifacts", async () => {
  const repo = mkRepo();
  // 兩個 change 宣告同一 schema、拿到同一份權威順序（模擬 per-schema 快取供出的結果），
  // 但各自的 artifact 集合不同 —— 每個 change 的 schemaOrder 必須只反映自身探索到的 ids。
  const authoritative = () => [
    { id: "proposal", outputPath: "proposal.md" },
    { id: "plan", outputPath: "plan.md" },
    { id: "tasks", outputPath: "tasks.md" },
  ];
  const a = path.join(repo, "openspec", "changes", "change-a");
  fs.mkdirSync(a, { recursive: true });
  fs.writeFileSync(path.join(a, ".openspec.yaml"), "schema: spec-driven\n");
  fs.writeFileSync(path.join(a, "proposal.md"), "## Why\n");
  fs.writeFileSync(path.join(a, "plan.md"), "plan\n");
  const b = path.join(repo, "openspec", "changes", "change-b");
  fs.mkdirSync(b, { recursive: true });
  fs.writeFileSync(path.join(b, ".openspec.yaml"), "schema: spec-driven\n");
  fs.writeFileSync(path.join(b, "proposal.md"), "## Why\n");
  fs.writeFileSync(path.join(b, "tasks.md"), "## Tasks\n- [ ] x\n");
  const da = await readChange(repo, "change-a", authoritative);
  const db = await readChange(repo, "change-b", authoritative);
  assert.deepEqual(da!.schemaOrder, ["proposal", "plan"]);
  assert.deepEqual(db!.schemaOrder, ["proposal", "tasks"]);
});

test("readChange: awaits an async (Promise) provider for an active change", async () => {
  const repo = mkRepo();
  const base = path.join(repo, "openspec", "changes", "bridge-change");
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, ".openspec.yaml"), "schema: spec-driven\n"); // 有 schema → provider 會被呼叫
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

// 合併縫合守衛：單一 ChangeDetail 需同時帶著 #6 的 artifacts 與 Timeline 的 created/archived。
// 既有測試各自只驗一半（日期測試不碰 artifacts，schemaOrder 測試不碰日期），故補這兩個同物件斷言。
test("readChange: archived change carries artifacts, dates and schema on one object", async () => {
  const repo = mkRepo();
  const base = path.join(repo, "openspec", "changes", "archive", "2026-03-01-add-widget");
  fs.mkdirSync(path.join(base, "specs", "topic-a"), { recursive: true });
  fs.writeFileSync(path.join(base, ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-02-25\n");
  fs.writeFileSync(path.join(base, "proposal.md"), "## Why\n");
  fs.writeFileSync(path.join(base, "tasks.md"), "## Tasks\n- [x] a\n- [ ] b\n");
  fs.writeFileSync(path.join(base, "specs", "topic-a", "spec.md"), "## ADDED\nx\n");
  const detail = await readChange(repo, "2026-03-01-add-widget", noOrder);
  assert.ok(detail);
  assert.equal(detail.status, "archived");
  assert.equal(detail.schema, "spec-driven");
  assert.equal(detail.createdDate, "2026-02-25");
  assert.equal(detail.archivedDate, "2026-03-01");
  assert.equal(detail.schemaOrder, undefined);
  assert.deepEqual(
    detail.artifacts.map((a) => a.id).sort(),
    ["proposal", "specs", "tasks"],
  );
  const tasks = detail.artifacts.find((a) => a.id === "tasks");
  assert.equal(tasks?.kind, "tasks");
  assert.equal(tasks?.tasks?.total, 2);
  assert.equal(detail.metadata?.created, "2026-02-25");
});

test("readChange: active change co-asserts schemaOrder, createdDate and artifacts together", async () => {
  const repo = mkRepo();
  // slug 帶日期前綴但仍在 changes/（非 archive/）→ status 為 active，archivedDate 必須為 null，
  // 用以釘住 status==="archived" 判定（而非只看 slug 形狀）
  const base = path.join(repo, "openspec", "changes", "2026-05-10-add-bridge");
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, ".openspec.yaml"), "schema: superpowers-bridge\ncreated: 2026-05-10\n");
  fs.writeFileSync(path.join(base, "proposal.md"), "## Why\n");
  fs.writeFileSync(path.join(base, "plan.md"), "plan\n");
  const provider = () => [
    { id: "proposal", outputPath: "proposal.md" },
    { id: "plan", outputPath: "plan.md" },
  ];
  const detail = await readChange(repo, "2026-05-10-add-bridge", provider);
  assert.ok(detail);
  assert.equal(detail.status, "active");
  assert.equal(detail.createdDate, "2026-05-10");
  assert.equal(detail.archivedDate, null);
  assert.equal(detail.schema, "superpowers-bridge");
  assert.deepEqual(detail.schemaOrder, ["proposal", "plan"]);
  assert.deepEqual(detail.artifacts.map((a) => a.id).sort(), ["plan", "proposal"]);
});

test("readChange: returns null for a change that does not exist", async () => {
  const repo = mkRepo();
  const detail = await readChange(repo, "no-such-change", noOrder);
  assert.equal(detail, null);
});

// repo 預設 schema（openspec/config.yaml schema:）寫入輔助
function writeRepoConfig(repoDir: string, schema: string): void {
  const dir = path.join(repoDir, "openspec");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "config.yaml"), `schema: ${schema}\n`);
}

test("scanOpenSpec: defaultSchema reads repo config.yaml schema", async () => {
  const repo = mkRepo();
  writeRepoConfig(repo, "spec-driven");
  writeChange(repo, "active", "add-foo", "schema: spec-driven\n");
  const result = await scanOpenSpec(repo);
  assert.equal(result.defaultSchema, "spec-driven");
});

test("scanOpenSpec: defaultSchema is null when repo has no config.yaml", async () => {
  const repo = mkRepo();
  writeChange(repo, "active", "add-foo", "schema: spec-driven\n");
  const result = await scanOpenSpec(repo);
  assert.equal(result.defaultSchema, null);
});

test("readChange: defaultSchema is the repo default even when the change declares another schema", async () => {
  const repo = mkRepo();
  writeRepoConfig(repo, "spec-driven");
  writeChange(repo, "active", "add-bridge", "schema: superpowers-bridge\n");
  const detail = await readChange(repo, "add-bridge", noOrder);
  assert.ok(detail);
  assert.equal(detail.schema, "superpowers-bridge");
  assert.equal(detail.defaultSchema, "spec-driven");
});

test("scanOpenSpec: every ChangeInfo carries the repo defaultSchema", async () => {
  const repo = mkRepo();
  writeRepoConfig(repo, "spec-driven");
  writeChange(repo, "active", "declared", "schema: superpowers-bridge\n");
  writeChange(repo, "active", "inherited", null);
  const result = await scanOpenSpec(repo);
  const declared = result.activeChanges.find((c) => c.slug === "declared");
  const inherited = result.activeChanges.find((c) => c.slug === "inherited");
  // 宣告自己 schema 的 change：schema 為自身，defaultSchema 仍是 repo 預設
  assert.equal(declared?.schema, "superpowers-bridge");
  assert.equal(declared?.defaultSchema, "spec-driven");
  // 未宣告的 change：schema 退回 repo 預設，defaultSchema 亦然（故 badge 應隱藏）
  assert.equal(inherited?.schema, "spec-driven");
  assert.equal(inherited?.defaultSchema, "spec-driven");
  // active change 的 status 應為 "active"（釘住 scanChangeDir 的 status 引數，非只靠 archivedDate 間接判定）
  assert.equal(inherited?.status, "active");
});

test("scanOpenSpec: reads config.yaml once regardless of change count", async () => {
  const repo = mkRepo();
  writeRepoConfig(repo, "spec-driven");
  // 三個都不宣告自己的 schema → 全部 fallback 回 repo 預設
  writeChange(repo, "active", "c1", null);
  writeChange(repo, "active", "c2", null);
  writeChange(repo, "archived", "2026-01-01-c3", null);
  const spy = mock.method(fs, "readFileSync");
  try {
    await scanOpenSpec(repo);
    const configReads = spy.mock.calls.filter((call) =>
      String(call.arguments[0]).replace(/\\/g, "/").endsWith("openspec/config.yaml"),
    ).length;
    // 預設 schema 只算一次並共用，而非每個 change 重讀
    assert.equal(configReads, 1);
  } finally {
    spy.mock.restore();
  }
});
