# Changelog

`@spekjs/core` has its own version line, independent of the spek product releases tracked in the
repository root `CHANGELOG.md`.

## 1.0.0

First public release on npm.

- **Renamed from `@spek/core` to `@spekjs/core`.** The `@spek` scope on npm is registered to another
  account, so the package could never have been published under its original name. The public API is
  unchanged — every function signature, type and subpath export is identical.
- **Runtime dependencies trimmed to `cross-spawn` alone.** The package previously declared `fuse.js`
  and `gray-matter`, neither of which it imports. Consumers no longer download them, nor
  `gray-matter`'s own transitive dependencies (`js-yaml`, `kind-of`, `section-matter`,
  `strip-bom-string`).
- Published with `dist/` and its type declarations only; sources are not shipped.
