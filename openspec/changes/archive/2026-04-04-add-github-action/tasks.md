## 1. Parameterize build-demo.ts

- [x] Add CLI argument parsing (`--repo-dir`, `--output`, `--title`) using `process.argv`
- [x] Introduce `REPO_DIR` variable that defaults to `ROOT` when no `--repo-dir` provided
- [x] Replace all `ROOT` references passed to `@spek/core` functions with `REPO_DIR` (scanOpenSpec, readSpec, readChange, readSpecAtChange, buildGraphData)
- [x] Replace `OUT_FILE` with resolved `--output` path (default: `docs/demo.html`)
- [x] Replace hardcoded `<title>` with `--title` argument (default: `spek — OpenSpec Viewer Demo`)
- [x] Ensure output directory is created from resolved output path (`fs.mkdirSync`)
- [x] Verify `npm run build:demo` (no args) still produces `docs/demo.html` identically

## 2. Create action.yml

- [x] Create `action.yml` at repo root with composite action definition
- [x] Define inputs: `repo-path`, `output-path`, `title`, `spek-version`
- [x] Define outputs: `html-path`
- [x] Add steps: checkout spek → setup Node.js → cache node_modules → npm ci → build core → run build-demo.ts → output html-path
- [x] Add branding (icon + color) for GitHub Marketplace

## 3. Create dogfood workflow

- [x] Create `.github/workflows/build-demo.yml`
- [x] Trigger on push to master with `openspec/**` path filter
- [x] Use local action (`uses: ./`) to build demo
- [x] Upload `docs/demo.html` as artifact or commit back

## 4. Documentation

- [x] Add GitHub Action usage section to README.md with workflow examples
- [x] Document `fetch-depth: 0` recommendation for accurate timestamps
- [x] Document GitHub Pages deployment example
