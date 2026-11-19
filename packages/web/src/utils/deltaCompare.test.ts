import { test } from "node:test";
import assert from "node:assert/strict";
import { compareModified, type DeltaMarks } from "./deltaCompare";

const lines = (...l: string[]) => l.join("\n") + "\n";

/** The main spec: requirement `Search` with scenarios A, B, D; `Other` with one scenario. */
const BASE = lines(
  "# search",
  "",
  "## Purpose",
  "### Requirement: Outside",
  "Not a requirement to OpenSpec: it is not under ## Requirements.",
  "",
  "## Requirements",
  "### Requirement: Search",
  "The system SHALL search.",
  "",
  "#### Scenario: A",
  "- **WHEN** a",
  "- **THEN** a",
  "",
  "#### Scenario: B",
  "- **WHEN** b",
  "- **THEN** b",
  "",
  "#### Scenario: D",
  "- **WHEN** d",
  "",
  "### Requirement: Other",
  "Other SHALL hold.",
  "",
  "#### Scenario: O",
  "- **WHEN** o",
);

/** Line number (1-based) of the first line in [source] that equals [text]. */
const at = (source: string, text: string): number => {
  const i = source.split("\n").indexOf(text);
  assert.ok(i >= 0, `no line ${JSON.stringify(text)}`);
  return i + 1;
};

const view = (source: string, marks: DeltaMarks) => {
  const label = (line: number) => source.split("\n")[line - 1];
  return {
    requirements: Object.fromEntries([...marks.requirements].map(([l, m]) => [label(l), m])),
    scenarios: Object.fromEntries([...marks.scenarios].map(([l, m]) => [label(l), m])),
    dropped: Object.fromEntries([...marks.dropped].map(([l, d]) => [label(l), d])),
  };
};

test("a scenario added, one reworded, one dropped", () => {
  const delta = lines(
    "## MODIFIED Requirements",
    "### Requirement: Search",
    "The system SHALL search.",
    "",
    "#### Scenario: A",
    "- **WHEN** a   ",
    "",
    "",
    "- **THEN** a",
    "",
    "#### Scenario: B",
    "- **WHEN** b, reworded",
    "- **THEN** b",
    "",
    "#### Scenario: C",
    "- **WHEN** c",
  );
  assert.deepEqual(view(delta, compareModified(delta, BASE)), {
    requirements: {},
    scenarios: { "#### Scenario: B": "changed", "#### Scenario: C": "new" },
    dropped: { "### Requirement: Search": ["D"] },
  });
});

test("a changed statement marks the requirement", () => {
  const delta = lines(
    "## MODIFIED Requirements",
    "### Requirement: Other",
    "Other SHALL hold, and more.",
    "",
    "#### Scenario: O",
    "- **WHEN** o",
  );
  assert.deepEqual(view(delta, compareModified(delta, BASE)).requirements, { "### Requirement: Other": "changed" });
});

test("a restated requirement reads same; reordered scenarios do not", () => {
  const same = lines("## MODIFIED Requirements", "### Requirement: Other", "Other SHALL hold.", "#### Scenario: O", "- **WHEN** o");
  assert.deepEqual(view(same, compareModified(same, BASE)), {
    requirements: { "### Requirement: Other": "same" },
    scenarios: {},
    dropped: {},
  });

  const reordered = lines(
    "## MODIFIED Requirements",
    "### Requirement: Search",
    "The system SHALL search.",
    "#### Scenario: B", "- **WHEN** b", "- **THEN** b",
    "#### Scenario: A", "- **WHEN** a", "- **THEN** a",
    "#### Scenario: D", "- **WHEN** d",
  );
  assert.deepEqual(view(reordered, compareModified(reordered, BASE)), { requirements: {}, scenarios: {}, dropped: {} });
});

test("header spelling is not text: `#### A` equals `#### Scenario: A ##`", () => {
  const base = lines("## Requirements", "### Requirement: R", "s", "#### Scenario: A ##", "- x");
  const delta = lines("## MODIFIED Requirements", "### Requirement: R ###", "s", "#### A", "- x");
  assert.deepEqual(view(delta, compareModified(delta, base)).requirements, { "### Requirement: R ###": "same" });
});

test("any #### is a scenario, and a ### Notes stays inside the scenario above it", () => {
  const base = lines("## Requirements", "### Requirement: R", "s", "#### Scenario: A", "- x", "### Notes", "old note");
  const delta = lines(
    "## MODIFIED Requirements",
    "### Requirement: R",
    "s",
    "#### Scenario: A",
    "- x",
    "### Notes",
    "new note",
    "#### Edge case",
    "- y",
  );
  assert.deepEqual(view(delta, compareModified(delta, base)).scenarios, {
    "#### Scenario: A": "changed",
    "#### Edge case": "new",
  });
});

test("same-named scenarios pair k-th to k-th; the unpaired base one is dropped", () => {
  const base = lines("## Requirements", "### Requirement: R", "s", "#### A", "- first", "#### A", "- second");
  const delta = lines("## MODIFIED Requirements", "### Requirement: R", "s", "#### A", "- first");
  assert.deepEqual(view(delta, compareModified(delta, base)), {
    requirements: {},
    scenarios: {},
    dropped: { "### Requirement: R": ["A"] },
  });
});

test("a rename is compared under its old name, and an unchanged one reads renamed-only", () => {
  const delta = lines(
    "## RENAMED Requirements",
    "- FROM: `### Requirement: Other`",
    "- TO: `### Requirement: Another`",
    "",
    "## MODIFIED Requirements",
    "### Requirement: Another",
    "Other SHALL hold.",
    "#### Scenario: O",
    "- **WHEN** o",
  );
  assert.deepEqual(view(delta, compareModified(delta, BASE)).requirements, { "### Requirement: Another": "renamed-only" });

  const added = delta + lines("#### Scenario: P", "- **WHEN** p");
  assert.deepEqual(view(added, compareModified(added, BASE)), {
    requirements: {},
    scenarios: { "#### Scenario: P": "new" },
    dropped: {},
  });
});

test("a rename synced early is looked up under its new name", () => {
  const base = lines("## Requirements", "### Requirement: Another", "s", "#### A", "- x");
  const delta = lines(
    "## RENAMED Requirements",
    "- FROM: `### Requirement: Old`",
    "- TO: `### Requirement: Another`",
    "## MODIFIED Requirements",
    "### Requirement: Another",
    "s",
    "#### A",
    "- x",
  );
  assert.deepEqual(view(delta, compareModified(delta, base)).requirements, { "### Requirement: Another": "same" });
});

test("a FROM/TO line without a requirement header is not a rename", () => {
  const delta = lines(
    "## RENAMED Requirements",
    "- FROM: Other",
    "- TO: Another",
    "## MODIFIED Requirements",
    "### Requirement: Another",
    "Other SHALL hold.",
  );
  assert.deepEqual(view(delta, compareModified(delta, BASE)).requirements, {
    "### Requirement: Another": "not-in-current-spec",
  });
});

test("no base requirement, a base outside ## Requirements, or no main spec: not in current spec, no scenario marks", () => {
  const delta = lines("## MODIFIED Requirements", "### Requirement: Outside", "x", "#### Scenario: Z", "- z");
  const expected = { requirements: { "### Requirement: Outside": "not-in-current-spec" }, scenarios: {}, dropped: {} };
  assert.deepEqual(view(delta, compareModified(delta, BASE)), expected);
  assert.deepEqual(view(delta, compareModified(delta, null)), expected);
});

test("added, removed and renamed sections carry nothing", () => {
  const delta = lines(
    "## ADDED Requirements",
    "### Requirement: Search",
    "Different text.",
    "#### Scenario: New",
    "- n",
    "## REMOVED Requirements",
    "### Requirement: Other",
  );
  const marks = compareModified(delta, BASE);
  assert.equal(marks.hasModified, false);
  assert.deepEqual(view(delta, marks), { requirements: {}, scenarios: {}, dropped: {} });
});

test("headings inside a fenced block are not structure", () => {
  const delta = lines(
    "## MODIFIED Requirements",
    "### Requirement: Other",
    "Other SHALL hold.",
    "#### Scenario: O",
    "- **WHEN** o",
    "````md",
    "#### Scenario: X",
    "```",
    "## Not a section",
    "````",
  );
  const v = view(delta, compareModified(delta, BASE));
  assert.ok(!("#### Scenario: X" in v.scenarios));
  assert.deepEqual(v.scenarios, { "#### Scenario: O": "changed" });
});

test("a byte order mark and CRLF endings change nothing, and line numbers hold", () => {
  const delta = lines("## MODIFIED Requirements", "### Requirement: Other", "Other SHALL hold.", "#### Scenario: O", "- **WHEN** o", "#### Scenario: N", "- n");
  const marks = compareModified("\uFEFF" + delta.replace(/\n/g, "\r\n"), BASE.replace(/\n/g, "\r\n"));
  assert.deepEqual([...marks.scenarios], [[at(delta, "#### Scenario: N"), "new"]]);
});

test("names written with markup still match by their raw text", () => {
  const base = lines("## Requirements", "### Requirement: Cache **at most once**", "s", "#### Scenario: duplicate \\_id", "- x");
  const delta = lines("## MODIFIED Requirements", "### Requirement: Cache **at most once**", "s", "#### Scenario: duplicate \\_id", "- y");
  assert.deepEqual(view(delta, compareModified(delta, base)).scenarios, { "#### Scenario: duplicate \\_id": "changed" });
});
