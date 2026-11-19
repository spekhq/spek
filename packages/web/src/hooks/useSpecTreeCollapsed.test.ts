import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSpecTree } from "@spekjs/core/spec-topic";
import {
  foldablePaths,
  nextCollapsed,
  readCollapsed,
  writeCollapsed,
  type StorageGetter,
} from "./useSpecTreeCollapsed";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
  return { data, get: (() => storage) as StorageGetter };
}

const KEY = (repo: string) => `spek:spec-tree-collapsed:${repo}`;

test("foldablePaths lists every folder with children, spec-bearing parents included, and no leaf", () => {
  const tree = buildSpecTree(
    ["auth", "contracts/pagination", "contracts/pagination/streaming-search", "guides/pagination"].map((topic) => ({ topic })),
  );
  assert.deepEqual(foldablePaths(tree), ["contracts", "contracts/pagination", "guides"]);
});

test("a stored list round-trips, per repository", () => {
  const s = memoryStorage();
  writeCollapsed(s.get, "/repo/a", new Set(["product", "quality"]));
  assert.deepEqual([...readCollapsed(s.get, "/repo/a")], ["product", "quality"]);
  assert.equal(readCollapsed(s.get, "/repo/b").size, 0);
  assert.deepEqual([...s.data.keys()], [KEY("/repo/a")]);
});

test("anything unreadable reads as nothing collapsed", () => {
  const cases: Record<string, StorageGetter> = {
    "missing value": memoryStorage().get,
    "not JSON": memoryStorage({ [KEY("r")]: "{oops" }).get,
    "not an array": memoryStorage({ [KEY("r")]: '{"product":true}' }).get,
    "a non-string entry": memoryStorage({ [KEY("r")]: '["product", 3]' }).get,
    "getItem throws": () => ({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {},
    }),
    // A sandboxed iframe throws on the localStorage getter itself; Node has no localStorage at all.
    "the getter throws": () => {
      throw new Error("SecurityError");
    },
    "no localStorage global": () => localStorage,
  };
  for (const [name, get] of Object.entries(cases)) {
    assert.equal(readCollapsed(get, "r").size, 0, name);
  }
});

test("a write that cannot reach storage is a no-op", () => {
  assert.doesNotThrow(() =>
    writeCollapsed(() => {
      throw new Error("SecurityError");
    }, "r", new Set(["a"])),
  );
  assert.doesNotThrow(() =>
    writeCollapsed(() => ({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    }), "r", new Set(["a"])),
  );
});

const FOLDABLE = ["process", "product", "quality"];

test("toggle closes and reopens one folder", () => {
  const closed = nextCollapsed(new Set(), { kind: "toggle", path: "product" }, FOLDABLE);
  assert.deepEqual([...closed], ["product"]);
  assert.equal(nextCollapsed(closed, { kind: "toggle", path: "product" }, FOLDABLE).size, 0);
});

test("collapse all closes every foldable folder; expand all closes none", () => {
  assert.deepEqual([...nextCollapsed(new Set(), { kind: "collapseAll" }, FOLDABLE)], FOLDABLE);
  assert.equal(nextCollapsed(new Set(FOLDABLE), { kind: "expandAll" }, FOLDABLE).size, 0);
});

test("a stale stored path is dropped on the next write", () => {
  const next = nextCollapsed(new Set(["renamed-away", "product"]), { kind: "toggle", path: "quality" }, FOLDABLE);
  assert.deepEqual([...next].sort(), ["product", "quality"]);
});
