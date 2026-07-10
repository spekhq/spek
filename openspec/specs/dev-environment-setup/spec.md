## Purpose

規範 monorepo 從 fresh clone 到可執行 dev 環境的建置流程，確保 @spekjs/core 已編譯且 npm run dev 能成功啟動。

## Requirements

### Requirement: Install builds the core package
A fresh-clone `npm install` at the repository root SHALL leave `@spekjs/core` in a compiled state so that consumers resolving its `dist/` entry points succeed without a separate manual build step.

#### Scenario: Fresh clone install compiles core
- **WHEN** a developer clones the repository and runs `npm install` at the root
- **THEN** `@spekjs/core` is compiled as part of the install
- **AND** `packages/core/dist/index.js` and `packages/core/dist/headings.js` exist afterward

### Requirement: Dev server starts from a clean environment
Running `npm run dev` after a fresh-clone `npm install` SHALL start the web version successfully. The root `dev` script SHALL build `@spekjs/core` before launching the web app so the Express API server and Vite dev server resolve `@spekjs/core` and `@spekjs/core/headings` even if `dist/` is missing or stale.

#### Scenario: npm run dev on a clean checkout
- **WHEN** a developer runs `npm run dev` after `npm install` on a clean checkout
- **THEN** `@spekjs/core` is built before the web app starts
- **AND** the Express API server starts without an `ERR_MODULE_NOT_FOUND` for `@spekjs/core/dist/index.js`
- **AND** the Vite dev server starts without an unresolved-import error for `@spekjs/core/headings`

#### Scenario: Dev recovers from a removed dist
- **WHEN** `packages/core/dist/` is deleted and the developer runs `npm run dev`
- **THEN** the root `dev` script rebuilds `@spekjs/core` before starting the web app
- **AND** the dev servers start successfully

### Requirement: Documented startup flow matches reality
The README Quick Start SHALL describe a startup flow that works on a fresh clone.

#### Scenario: Following README from a fresh clone
- **WHEN** a new user follows the README Quick Start steps in order on a fresh clone
- **THEN** the documented commands start the web version without module-resolution errors
