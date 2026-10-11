/**
 * Reads, from disk, the notice of each package the demo bundle ships — the I/O half of
 * `demo-notices.ts`. No side effects at import.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { ownLicenseText, type PackageNotice, type ShippedPackage } from "./demo-notices.js";

const LICENSE_FILE = /^(licen[cs]e|copying)(\.(md|txt|markdown))?$/i;

/** A package named rather than located (Vite, for its helpers; Tailwind, for its CSS) resolves from `fromDir`. */
function rootOf(pkg: ShippedPackage, fromDir: string): string {
  if (pkg.root) return pkg.root;
  const require = createRequire(path.join(fromDir, "package.json"));
  return path.dirname(require.resolve(`${pkg.name}/package.json`));
}

export function readPackageNotice(pkg: ShippedPackage, fromDir: string): PackageNotice {
  const root = rootOf(pkg, fromDir);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8")) as {
    name?: string;
    version?: string;
    license?: string | { type?: string };
  };
  const license = typeof manifest.license === "string" ? manifest.license : manifest.license?.type ?? "UNKNOWN";
  const file = fs.readdirSync(root).filter((f) => LICENSE_FILE.test(f)).sort()[0];
  const text = file ? ownLicenseText(fs.readFileSync(path.join(root, file), "utf-8")) : null;
  return { name: manifest.name ?? pkg.name, version: manifest.version ?? "0.0.0", license, text };
}
