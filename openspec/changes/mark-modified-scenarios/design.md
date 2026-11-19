## Context

A change's Specs tab renders each delta spec through `MarkdownRenderer` (`specShaped`, folded), fed by
`ChangeDetail.artifacts[kind=specs].specs: { topic, content }[]`, which `readChange` fills from the change
directory only. Nothing on the client knows the main spec a delta modifies. The client could fetch it with
`getSpec(topic)`, but that reads the adapter's repository, not the worktree a `wt` change came from, and it is a
request per topic.

Every host reads a change through `readChange` (`@spekjs/core`: Web server, VS Code host, demo build) or its
Kotlin mirror `ChangeReader` (IntelliJ). The Web server and VS Code host already pass the worktree's own path
when `wt` is given; IntelliJ has no `wt` and reads the project path.

## Goals / Non-Goals

**Goals:**
- Marks computed from data the change read already holds, from the same working directory as the delta.
- A comparison rule stated once, pure, and testable without a DOM.

**Non-Goals:**
- The full "changes only" view with line-level diffs and collapsed unchanged scenarios (the issue's larger
  proposal).
- A base for archived changes (the main spec as of the commit before archiving). It needs git history that the
  static demo and shallow clones lack, and a commit search per read; it is the natural next step, behind the
  same comparison function.
- Marks on the spec detail page's history view or in the native sidebar trees.

## Decisions

**The base travels with the change, as `base` on each delta entry.** `readChange` already resolves the working
directory, so it reads `openspec/specs/<topic>/spec.md` there with `resolveSpecFile` — the same rule, symlink and
case guards as every spec read — and sets `base` to its content or `null`. Archived changes get no `base` at all
and the client decides whether to compare **by the change's status, never by the field**: the IntelliJ server
serialises with `encodeDefaults = true` and default `explicitNulls`, so a Kotlin `base: String? = null` is
emitted as `"base": null` on an archived change too (as `file` already is), and "absent" versus `null` cannot be
held apart there. `base` therefore only distinguishes "there is a main spec" (a string) from "there is none"
(`null`), and only for an active change. Alternative rejected: client-side `getSpec(topic)` per delta —
wrong working directory for `wt` changes, and N extra round trips through every adapter.

**The comparison is a web utility, not core.** Only the SPA draws marks, and the IntelliJ tool window loads the
same SPA, so there is no second host to agree with; putting it in core would add a published API with one
caller. `utils/deltaCompare.ts` exports `compareModified(delta, base): ModifiedComparison[]`, a pure function
over two Markdown strings.

**Parsing mirrors OpenSpec's, not a Markdown AST** — read from OpenSpec 2.1.0's source (`requirement-blocks.ts`,
`requirement-text.ts`, `code-fence.ts`, commit `e6539de`); the CLI on the maintainer's machine is 1.10.0, so the
reference is the source, not the installed tool. OpenSpec decides structure by line, with fenced blocks masked:
- a requirement starts at `### Requirement:` (keyword case-insensitive) and ends only at the next
  `### Requirement:` or `## ` — an ordinary `### Notes` stays inside it; its name is trimmed, a closing `#`
  sequence removed, matched case-sensitively;
- a scenario is **any** `#### ` header, not only `#### Scenario:` (`SCENARIO_HEADER = /^####\s+/`), and ends only at
  the next `#### `; its name drops a closing `#` sequence and a leading `Scenario:` (any case). OpenSpec widened
  this on purpose (1.9.0: "Stop silently dropping unlabeled scenarios"), so reading only `#### Scenario:` would
  leave content out of the comparison that `openspec archive` counts;
- a scenario's text is its lines after the header, so `#### Scenario: A` and `#### A` — one name to OpenSpec —
  compare equal; same-named scenarios pair k-th with k-th in document order, extras on either side being new or
  dropped, which is how OpenSpec's `diffScenarioNames` counts them;
- RENAMED pairs are `FROM:` / `TO:` lines that carry a `### Requirement:` header (bullet and backticks optional; a
  bare `- FROM: Old` is not a pair). A pair whose old name is gone from the base while its new name is present was
  synced early, and OpenSpec then treats the rename as applied — so does the comparison, looking the requirement
  up under its new name;
- both sources lose a leading byte order mark and have `\r\n?` normalised before any of this, as OpenSpec's
  `normalizeLineEndings` does: a Windows editor's BOM would otherwise make the first line's `##` fail to match
  while react-markdown still renders the heading, and the whole section would go unmarked;
- section headers (`## MODIFIED Requirements`, `## RENAMED Requirements`, `## Requirements`) match
  case-insensitively; RENAMED pairs are `FROM:` / `TO:` lines, bullet and backticks optional;
- on the base side only the `## Requirements` section is read, which is where `openspec archive` builds its name
  map — a `### Requirement:` under `## Purpose` is not a requirement to it.
A requirement's statement is its text after the header line and before its first scenario, so a renamed
requirement's new name never makes its statement "changed".

**Normalisation is whitespace only.** Each line's trailing whitespace is removed and blank lines are dropped
before comparing. Anything else — a reworded sentence, a changed keyword's case — is a change, because those are
the edits a reviewer needs to see.

**Marks are placed by source line, before folding.** The comparison names things by their raw header text, as
OpenSpec does; the rendered heading's text is what Markdown made of it — bold, escapes (`\_`), entities, links and
code spans all differ. This repository's spec headings hold code spans; the other forms are ones CommonMark
rewrites and any author may write. Matching the two by text would drop a mark
silently, which looks exactly like "nothing changed". So `compareModified` reports, for every mark, the 1-based
**line number** of the header it belongs to in the delta source, and `rehypeSpekDeltaMarks(marks)` matches a
heading by `node.position.start.line`, which every hast heading carries. Both sides normalise `\r\n?` to `\n`
first, so the lines agree. Duplicate names then cost nothing: each line is its own heading.

The plugin sets `data-spek-delta` on the matched `h3` / `h4`, and for a requirement with dropped scenarios inserts
one element after its `h3` whose names are inline `code` nodes — so the paragraph's BDD highlighting, which would
paint an `ADDED` or `SHALL` inside a scenario name, never sees them. It runs after heading ids (their dedup counter
needs the original tree) and before folding (which regroups by headings), so the inserted element becomes part of
the requirement's folded body and a marked `h4` is its scenario's `summary`, visible while folded. Where OpenSpec
and CommonMark disagree about what is a heading — `###Requirement:` with no space is a requirement to OpenSpec and a
paragraph when rendered; an indented or quoted `### Requirement:` is the reverse — there is no heading on that line
to mark, and nothing is marked.

**A dropped scenario is flagged, not just listed.** OpenSpec 2.1.0 refuses to archive a MODIFIED block that drops
a scenario the current requirement has (`specs-apply.ts`, and `validate` reports it), so the dropped line carries
that note rather than reading like an ordinary removal.

**`same as current spec` exists so an empty result means something.** Without it, a requirement restated
verbatim, one already synced into the main spec ahead of archiving, and a mark that failed to place would all
look identical. With it, a modified requirement whose header renders as a heading always carries some mark when
a base exists. `same as current spec` requires the scenarios in the same order — OpenSpec counts a reorder as a
modification — and a requirement reached through a rename that is otherwise unchanged reads `renamed only`, since
its heading does differ from the current spec's.

**Marks reuse the delta-operation badge pairs, no new colour.** `new` uses ADDED's (`text-badge-added` on
`bg-orange-500/20`), `changed` MODIFIED's, the dropped line REMOVED's, and `same as current spec` / `not in current
spec` the muted text token. The meaning lines up — added, modified, removed. These badge pairs are measured by hand
for the markdown renderer (worst 4.86:1 dark / 4.97:1 light, recorded in `contrast.test.ts`'s
`NOT_MEASURED_HERE`), not by the automated scan — whose palette rule only catches `text-*` — so the obligation
here is that the new pills sit on the same page surfaces those figures were taken against: inside an `h3` / `h4`,
a `summary`, or the dropped element in a requirement's folded body, none of which sets a background.

**The archived note is one line in `SpecsTabContent`,** shown when the change is archived and any delta has a
`## MODIFIED Requirements` section with a requirement in it. `SpecsTabContent` gains a `status` prop.

## Risks / Trade-offs

- [The main spec moved on since the change was written — someone archived another change touching the same
  requirement] → the marks then describe the difference from *today's* spec, which is also what `openspec
  archive` would apply against; a `changed` mark the author did not intend is a real conflict worth seeing.
- [The author synced the delta into the main spec before archiving] → every requirement compares equal and reads
  `same as current spec` (an early-synced rename included, since it is looked up under its new name), which is
  true and says why there is nothing else.
- [A `wt` change's base comes from the wrong tree] → the worktree is chosen by the caller, which already passes the
  worktree's path to `readChange` (`server/routes/openspec.ts`, `vscode/src/handler.ts`); `readChange` reads
  `base` from the directory it is given, which 1.1 tests.
- [The `ChangeArtifact` payload grows by one spec per delta topic] → bounded by the delta topics of one change;
  the demo payload grows only for active changes.
- [Kotlin and TypeScript `readChange` drift on `base`] → both are tested on the same rule (content for an active change's
  existing topic, `null` for a missing one), Kotlin at the JSON level too; an archived change's field is never
  read, so the one place the two serialisations differ (absent vs `null`) carries no meaning.
