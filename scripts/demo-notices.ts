/**
 * The third-party notices the demo page carries for what it ships.
 *
 * The page is one file holding a bundle of third-party code — React, React Router, the Markdown and
 * syntax-highlighting stack, d3 modules — and every host that serves it (GitHub Pages, spekterm.com, a
 * GitHub Action consumer's Pages site) redistributes that code, whose licences ask for their notices
 * to travel with it. The list is derived from the bundle itself: `vite.demo.config.ts` records the
 * modules rendered into the chunk after tree-shaking, so a package is listed exactly when the page
 * contains its code.
 *
 * Pure, like `demo-html.ts`; `demo-notice-sources.ts` reads the packages from disk.
 */

export interface ShippedPackage {
  name: string;
  /** The package's directory, as the bundler resolved it — `null` for one named rather than located. */
  root: string | null;
}

export interface PackageNotice {
  name: string;
  version: string;
  /** The `license` field of its `package.json`. */
  license: string;
  /** The text of its licence file, or `null` when the package ships none. */
  text: string | null;
}

const NODE_MODULES = "/node_modules/";

/**
 * Rollup's and Vite's own helpers enter the bundle as virtual modules (`\0commonjsHelpers.js`,
 * `\0vite/preload-helper.js`). Vite is what puts them there, so they are Vite's code.
 */
function isBuildToolHelper(id: string): boolean {
  return id === "commonjsHelpers.js" || id.startsWith("vite/");
}

/**
 * The package a module id belongs to: the last `node_modules` segment of its path, scoped names
 * included, with Rollup's `\0` prefix and any `?query` removed. `null` for the project's own code
 * (the workspace packages resolve to their real paths, outside `node_modules`).
 */
export function shippedPackageOf(id: string): ShippedPackage | null {
  const clean = id.replace(/^\0/, "").split("?")[0].replace(/\\/g, "/");
  if (isBuildToolHelper(clean)) return { name: "vite", root: null };
  const at = clean.lastIndexOf(NODE_MODULES);
  if (at === -1) return null;
  const segments = clean.slice(at + NODE_MODULES.length).split("/");
  const name = segments[0].startsWith("@") ? `${segments[0]}/${segments[1]}` : segments[0];
  return { name, root: clean.slice(0, at + NODE_MODULES.length) + name };
}

/** Every distinct package among `ids`, by root, sorted by name. */
export function shippedPackages(ids: readonly string[]): ShippedPackage[] {
  const byKey = new Map<string, ShippedPackage>();
  for (const id of ids) {
    const pkg = shippedPackageOf(id);
    if (pkg) byKey.set(`${pkg.name}\0${pkg.root ?? ""}`, pkg);
  }
  return [...byKey.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * A licence file's notice for the package itself. Vite's `LICENSE.md` appends the licences of the
 * dependencies bundled into Vite's own build — code that runs in the bundler, not in this page — so
 * only the part before that section is the notice for what the page contains.
 */
export function ownLicenseText(text: string): string {
  const cut = text.indexOf("\n# Licenses of bundled dependencies");
  return (cut === -1 ? text : text.slice(0, cut)).trim();
}

/**
 * The notices as plain text, one entry per `name@version`. Throws on an empty list — a bundle with no
 * third-party code would mean the record of shipped modules went blind, not that React left the page.
 */
export function formatNotices(notices: readonly PackageNotice[]): string {
  if (notices.length === 0) throw new Error("no third-party package recorded in the demo bundle");
  const seen = new Set<string>();
  const entries: string[] = [];
  for (const n of [...notices].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const key = `${n.name}@${n.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const body = n.text?.trim() || `Licensed under ${n.license}; the package ships no licence file.`;
    entries.push(`${key} (${n.license})\n\n${body}`);
  }
  return (
    "Third-party software in this page\n\n" +
    "This page bundles the following packages. Each entry is the package's name, version and licence, " +
    "followed by its licence text.\n\n" +
    entries.map((e) => `${"-".repeat(72)}\n${e}`).join("\n\n") +
    "\n"
  );
}
