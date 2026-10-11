import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNotices, ownLicenseText, shippedPackageOf, shippedPackages } from "./demo-notices.js";

test("a module id names its package by the last node_modules segment, scoped names included", () => {
  assert.deepEqual(shippedPackageOf("/repo/node_modules/react/cjs/react.production.js"), {
    name: "react",
    root: "/repo/node_modules/react",
  });
  assert.deepEqual(shippedPackageOf("\0/repo/node_modules/@ungap/structured-clone/esm/index.js?commonjs-proxy"), {
    name: "@ungap/structured-clone",
    root: "/repo/node_modules/@ungap/structured-clone",
  });
  assert.deepEqual(shippedPackageOf("/repo/node_modules/a/node_modules/b/index.js"), {
    name: "b",
    root: "/repo/node_modules/a/node_modules/b",
  });
  assert.deepEqual(shippedPackageOf("C:\\repo\\node_modules\\d3-force\\src\\index.js")?.name, "d3-force");
});

test("the bundler's helpers are Vite's; the project's own modules are nobody's", () => {
  assert.deepEqual(shippedPackageOf("\0commonjsHelpers.js"), { name: "vite", root: null });
  assert.deepEqual(shippedPackageOf("\0vite/preload-helper.js"), { name: "vite", root: null });
  assert.equal(shippedPackageOf("/repo/packages/web/src/App.tsx"), null);
  assert.equal(shippedPackageOf("/repo/packages/core/dist/headings.js"), null);
});

test("packages are listed once per root, sorted by name", () => {
  const ids = [
    "/r/node_modules/react/index.js",
    "/r/node_modules/react/cjs/react.production.js",
    "/r/node_modules/d3-zoom/src/zoom.js",
    "\0vite/preload-helper.js",
    "\0commonjsHelpers.js",
    "/r/packages/web/src/main.demo.tsx",
  ];
  assert.deepEqual(
    shippedPackages(ids).map((p) => p.name),
    ["d3-zoom", "react", "vite"],
  );
});

test("Vite's licence keeps its own notice and drops its bundled dependencies'", () => {
  const text = "# Vite core license\nMIT License\n\nCopyright (c) VoidZero\n\n# Licenses of bundled dependencies\nThe published Vite artifact…";
  assert.equal(ownLicenseText(text), "# Vite core license\nMIT License\n\nCopyright (c) VoidZero");
  assert.equal(ownLicenseText("MIT License\n\nCopyright (c) Meta\n"), "MIT License\n\nCopyright (c) Meta");
});

test("the notices carry each package's name, version, licence and text, once per version", () => {
  const text = formatNotices([
    { name: "react", version: "19.1.0", license: "MIT", text: "MIT License\nCopyright (c) Meta" },
    { name: "bail", version: "2.0.2", license: "MIT", text: null },
    { name: "react", version: "19.1.0", license: "MIT", text: "MIT License\nCopyright (c) Meta" },
  ]);
  assert.ok(text.startsWith("Third-party software in this page\n"));
  assert.equal(text.match(/react@19\.1\.0 \(MIT\)/g)?.length, 1);
  assert.ok(text.indexOf("bail@2.0.2") < text.indexOf("react@19.1.0"), "sorted by name");
  assert.match(text, /Copyright \(c\) Meta/);
  assert.match(text, /bail@2\.0\.2 \(MIT\)\n\nLicensed under MIT; the package ships no licence file\./);
});

test("an empty list stops the build rather than shipping a page with no notices", () => {
  assert.throws(() => formatNotices([]), /no third-party package/);
});
