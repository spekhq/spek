import fs from "node:fs";
import path from "node:path";
import { compareCodeUnits, isSafeSpecTopic } from "./spec-topic.js";

/**
 * Which `spec.md` files under a `specs/` root are specs, by OpenSpec's own rule (`discoverSpecFiles`,
 * OpenSpec #1353), so spek shows exactly the capabilities OpenSpec validates and archives:
 *
 * - dot-entries are skipped, and symlinked directories are not followed;
 * - a `spec.md` directly in the root is not a spec — a spec lives in a capability folder;
 * - a regular `spec.md` is one, and so is a symlinked `spec.md` whose canonical target is a regular file
 *   inside the root or, failing that, inside its own capability directory; a dangling link is skipped.
 *
 * One deliberate divergence: where OpenSpec throws (a link escaping both, an unreadable directory),
 * this omits the entry and keeps scanning. OpenSpec feeds an archive merge, where a dropped capability
 * is lost data; spek is a viewer, where failing would blank the whole repository over one bad entry.
 */

export interface SpecFile {
  topic: string;
  file: string;
}

function isWithin(dir: string, target: string): boolean {
  const rel = path.relative(dir, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

function realpathOrNull(p: string): string | null {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return null;
  }
}

function lstatOrNull(p: string): fs.Stats | null {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

/**
 * True when `dir` holds an entry spelled exactly `name`. A case-insensitive filesystem (macOS, Windows)
 * answers an lstat for `AUTH` or, on Windows, `auth.` too, but discovery lists names as stored.
 */
function hasEntry(dir: string, name: string): boolean {
  try {
    return fs.readdirSync(dir).includes(name);
  } catch {
    return false;
  }
}

/** The target rule for a `spec.md` that is a symlink. `capabilityDir` is the directory holding it. */
function isAcceptedSpecLink(specsRoot: string, capabilityDir: string, file: string): boolean {
  let isFile: boolean;
  try {
    isFile = fs.statSync(file).isFile();
  } catch {
    return false;
  }
  const target = realpathOrNull(file);
  if (!isFile || target === null) return false;
  const root = realpathOrNull(specsRoot);
  const capability = realpathOrNull(capabilityDir);
  return (root !== null && isWithin(root, target)) || (capability !== null && isWithin(capability, target));
}

/** The walk, in directory order. A generator so a presence check stops at the first hit. */
function* walkSpecFiles(specsRoot: string): Generator<SpecFile> {
  function* walk(dir: string, segments: string[]): Generator<SpecFile> {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* walk(full, [...segments, entry.name]);
      } else if (entry.name === "spec.md" && segments.length > 0) {
        if (entry.isFile() || (entry.isSymbolicLink() && isAcceptedSpecLink(specsRoot, dir, full))) {
          yield { topic: segments.join("/"), file: full };
        }
      }
    }
  }
  yield* walk(specsRoot, []);
}

/** Every spec under `specsRoot`, ordered by topic in code-unit order. A missing root is empty. */
export function discoverSpecFiles(specsRoot: string): SpecFile[] {
  return [...walkSpecFiles(specsRoot)].sort((a, b) => compareCodeUnits(a.topic, b.topic));
}

/** True when `specsRoot` holds at least one spec. Stops at the first. */
export function hasSpecFiles(specsRoot: string): boolean {
  return !walkSpecFiles(specsRoot).next().done;
}

/**
 * The `spec.md` of `topic` under `specsRoot`, or null — only when discovery would list that topic.
 *
 * Containment is not enough: `.drafts/x`, or a path through a symlinked directory pointing back inside
 * the root, stays contained yet names a topic the list never shows. So discovery's rule is applied to
 * this one path: the validator refuses dotted segments, every segment and `spec.md` must be spelled as
 * its directory stores it, every intermediate directory must be a real directory (lstat, not stat), and
 * a linked `spec.md` must pass the same target rule.
 */
export function resolveSpecFile(specsRoot: string, topic: string): string | null {
  if (!isSafeSpecTopic(topic)) return null;
  let dir = specsRoot;
  for (const segment of topic.split("/")) {
    if (!hasEntry(dir, segment)) return null;
    dir = path.join(dir, segment);
    if (!lstatOrNull(dir)?.isDirectory()) return null;
  }
  if (!hasEntry(dir, "spec.md")) return null;
  const file = path.join(dir, "spec.md");
  const st = lstatOrNull(file);
  if (st?.isFile()) return file;
  if (st?.isSymbolicLink() && isAcceptedSpecLink(specsRoot, dir, file)) return file;
  return null;
}
