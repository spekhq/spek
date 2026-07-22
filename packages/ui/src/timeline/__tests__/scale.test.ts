import { test } from "node:test";
import assert from "node:assert/strict";
import { scaleTime, generateTicks, dateRange, padDomain, formatTickLabel } from "../scale.js";

test("scaleTime: linear mapping", () => {
  const fn = scaleTime("2026-01-01", "2026-01-11", 0, 100);
  assert.equal(fn("2026-01-01"), 0);
  assert.equal(fn("2026-01-11"), 100);
  assert.equal(fn("2026-01-06"), 50);
});

test("scaleTime: domainStart === domainEnd returns rangeStart", () => {
  const fn = scaleTime("2026-01-01", "2026-01-01", 10, 100);
  assert.equal(fn("2026-01-01"), 10);
});

test("scaleTime: invalid date returns rangeStart", () => {
  const fn = scaleTime("2026-01-01", "2026-01-11", 0, 100);
  assert.equal(fn("not-a-date"), 0);
});

test("generateTicks: span < 14 → daily major", () => {
  const ticks = generateTicks("2026-01-01", "2026-01-08");
  // 2026-01-01 ~ 2026-01-08 inclusive = 8 days
  assert.equal(ticks.major.length, 8);
  assert.equal(ticks.major[0], "2026-01-01");
  assert.equal(ticks.major[7], "2026-01-08");
  assert.equal(ticks.minor.length, 0);
});

test("generateTicks: span 14-60 → weekly Monday major", () => {
  const ticks = generateTicks("2026-01-01", "2026-02-15"); // ~45 days
  // 2026-01-05 是星期一
  assert.equal(ticks.major[0], "2026-01-05");
  // 每 7 天一個
  for (let i = 1; i < ticks.major.length; i++) {
    const prev = new Date(ticks.major[i - 1] + "T00:00:00Z").getTime();
    const cur = new Date(ticks.major[i] + "T00:00:00Z").getTime();
    assert.equal((cur - prev) / 86400000, 7);
  }
  assert.equal(ticks.minor.length, 0);
});

test("generateTicks: span 60-365 → monthly major + weekly minor", () => {
  const ticks = generateTicks("2026-01-01", "2026-06-30"); // ~180 days
  // major 為各月 1 日（含起始月若已是 1 號）
  assert.deepEqual(ticks.major, [
    "2026-01-01",
    "2026-02-01",
    "2026-03-01",
    "2026-04-01",
    "2026-05-01",
    "2026-06-01",
  ]);
  // minor 每週一，但跳過剛好等於月 1 日的
  assert.ok(ticks.minor.length > 0);
  // 應不包含任何月 1 日
  assert.ok(!ticks.minor.includes("2026-02-01"));
});

test("generateTicks: span > 365 → quarterly major + monthly minor", () => {
  const ticks = generateTicks("2026-01-01", "2027-06-30"); // ~545 days
  // 季度起始：1, 4, 7, 10
  // 跨度 2026-Q1 到 2027-Q2，期望 Q2/Q3/Q4 2026、Q1/Q2 2027（看實際邏輯）
  for (const iso of ticks.major) {
    const m = Number(iso.slice(5, 7));
    assert.ok([1, 4, 7, 10].includes(m), `quarter month expected, got ${iso}`);
    assert.equal(iso.slice(8), "01");
  }
  // minor: 月 1 日，但跳過季度起始月
  for (const iso of ticks.minor) {
    const m = Number(iso.slice(5, 7));
    assert.ok(![1, 4, 7, 10].includes(m), `non-quarter month expected, got ${iso}`);
    assert.equal(iso.slice(8), "01");
  }
});

test("generateTicks: invalid range returns empty", () => {
  assert.deepEqual(generateTicks("2026-02-01", "2026-01-01"), { major: [], minor: [] });
  assert.deepEqual(generateTicks("bad", "2026-01-01"), { major: [], minor: [] });
});

test("dateRange: ignores nulls and invalid", () => {
  assert.deepEqual(
    dateRange(["2026-03-01", null, "2026-01-15", "bad", undefined, "2026-02-20"]),
    { min: "2026-01-15", max: "2026-03-01" },
  );
});

test("dateRange: empty input returns null", () => {
  assert.equal(dateRange([null, undefined, "bad"]), null);
});

test("padDomain: adds N days each side", () => {
  assert.deepEqual(padDomain("2026-02-10", "2026-02-20", 3), {
    min: "2026-02-07",
    max: "2026-02-23",
  });
});

test("formatTickLabel: short / month / quarter forms", () => {
  assert.equal(formatTickLabel("2026-03-15", 7), "Mar 15");
  assert.equal(formatTickLabel("2026-03-15", 30), "Mar 15");
  assert.equal(formatTickLabel("2026-03-01", 180), "Mar");
  assert.equal(formatTickLabel("2026-04-01", 500), "Q2 2026");
});
