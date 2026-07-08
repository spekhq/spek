import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCachedDefaultSchema } from "./useOpenSpec";

type Entry = { refreshKey: number; value: string | null };

// resolveCachedDefaultSchema 是 useDefaultSchema 的快取決策核心：決定「命中不重抓 / 換 repo /
// 偵測到變更後失效」三種轉換。以純函式覆蓋，避免需要 DOM 就能釘住這裡的迴歸風險。
test("resolveCachedDefaultSchema: cache hit at the same refreshKey is served without refetch", () => {
  const cache = new Map<string, Entry>([["/repo-a", { refreshKey: 0, value: "spec-driven" }]]);
  assert.deepEqual(resolveCachedDefaultSchema(cache, "/repo-a", 0), {
    fresh: true,
    value: "spec-driven",
  });
});

test("resolveCachedDefaultSchema: cached null is still a fresh hit (does not refetch)", () => {
  const cache = new Map<string, Entry>([["/repo-a", { refreshKey: 2, value: null }]]);
  assert.deepEqual(resolveCachedDefaultSchema(cache, "/repo-a", 2), { fresh: true, value: null });
});

test("resolveCachedDefaultSchema: a different repo misses (no stale cross-repo value)", () => {
  const cache = new Map<string, Entry>([["/repo-a", { refreshKey: 0, value: "spec-driven" }]]);
  assert.deepEqual(resolveCachedDefaultSchema(cache, "/repo-b", 0), { fresh: false });
});

test("resolveCachedDefaultSchema: a bumped refreshKey invalidates the cache (change detected while unmounted)", () => {
  // 模擬：Specs 頁未掛載時 config.yaml 變更 → refreshKey 全域遞增；下次進頁面應 miss 而重抓
  const cache = new Map<string, Entry>([["/repo-a", { refreshKey: 0, value: "spec-driven" }]]);
  assert.deepEqual(resolveCachedDefaultSchema(cache, "/repo-a", 1), { fresh: false });
});
