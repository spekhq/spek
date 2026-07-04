## Purpose

從 OpenSpec 資料產生 SVG 狀態徽章（specs 數、open changes、tasks 進度），供 README 與 CI 嵌入。

## Requirements

### Requirement: Badge generation script
The project SHALL provide a `scripts/generate-badges.ts` script that scans an OpenSpec directory and generates SVG badge files.

#### Scenario: Generate all badges
- **WHEN** `generate-badges.ts` is invoked with `--repo-dir /path/to/repo --output-dir /path/to/output`
- **THEN** it generates three SVG files: `specs.svg`, `open_changes.svg`, and `tasks.svg` in the output directory

#### Scenario: Specs badge content
- **WHEN** the target repo has 15 specs
- **THEN** `specs.svg` displays "specs | 15"

#### Scenario: Open changes badge content
- **WHEN** the target repo has 3 active changes
- **THEN** `open_changes.svg` displays "open changes | 3"

#### Scenario: Tasks badge content
- **WHEN** the target repo has 10 total tasks with 7 completed
- **THEN** `tasks.svg` displays "tasks | 7 / 10"

#### Scenario: Tasks badge with no tasks
- **WHEN** the target repo has no tasks across all active changes
- **THEN** `tasks.svg` displays "tasks | 0 / 0"

### Requirement: Badge visual style
The generated SVG badges SHALL use a flat style consistent with shields.io conventions.

#### Scenario: Badge appearance
- **WHEN** a badge SVG is rendered in a browser or GitHub README
- **THEN** it displays as a two-part label-value badge with readable text and appropriate colors
