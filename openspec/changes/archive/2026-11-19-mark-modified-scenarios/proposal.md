## Why

Issue #71: OpenSpec requires a `## MODIFIED Requirements` entry to restate the whole requirement, every
scenario included. A change that adds one scenario to a requirement holding twenty shows twenty-one in its Specs
tab, and nothing says which one is new — the reviewer opens the current spec beside it and compares by eye. The
Spec Diff on the spec page does not help: it lives on another page and line-diffs the whole delta file against
the whole spec, so most of the result is the rest of the spec showing as removed.

This change takes the reporter's proposed first step: keep the delta rendered as it is, and mark what each
modified requirement actually changes. The full side-by-side "changes only" view, and comparing archived
changes against the spec as it stood before archiving, are left for later.

## What Changes

- In a change's Specs tab, for each requirement under `## MODIFIED Requirements` of an **active** change, compared
  against the same-named requirement in the current main spec of the working directory the change was read from:
  - a scenario that the current requirement does not have is marked **new**;
  - a scenario whose text differs from the current one of the same name is marked **changed**;
  - scenarios the current requirement has and the modified one no longer lists are named in a **dropped** line,
    noting that OpenSpec refuses to archive such a modification;
  - a requirement whose own statement (the text before its first scenario) differs is marked **changed**;
  - a requirement with no counterpart in the current spec is marked **not in current spec**;
  - a requirement restated without any change is marked **same as current spec**, so an absence of marks never
    has to be interpreted.
  - `## RENAMED Requirements` pairs are honoured: a modified requirement under its new name is compared with the
    current requirement under its old name.
- An archived change shows no marks: the current spec already contains it, so it is the wrong base. The tab says
  so in one line when the change has modified requirements.
- The change detail payload carries, for an active change, each delta spec's base — the content of the main spec
  of the same topic, or none when there is no such spec.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `change-browsing`: the Specs tab marks what each modified requirement changes.
- `openspec-api`: the single-change response carries each delta spec's base content for an active change.

## Impact

- `@spekjs/core`: `readChange` fills `base` on each entry of the `specs` artifact for active changes;
  `ChangeArtifact.specs` gains an optional `base?: string | null` field. **Additive public type change → a minor
  bump of `@spekjs/core`** for whoever cuts the release.
- `packages/web`: a pure delta/base comparison in `utils/`, a rehype plugin placing the marks, badge rendering in
  `MarkdownRenderer`, and the archived-change note in `SpecsTabContent`.
- `packages/intellij`: the Kotlin `ChangeReader` mirrors the `base` field so the IntelliJ tool window shows the
  same marks.
- Reaches Web, VS Code and IntelliJ. The demo embeds `readChange` output, but is rebuilt at release time when this
  repository usually has no active change, so it will rarely show marks.
