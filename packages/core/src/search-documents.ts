// The filesystem side of the search corpus: one document per spec, one per change root artifact file.
//
// The other producer is `changeSearchDocuments` in search.ts, which builds the same documents from an
// already-loaded ChangeDetail for hosts that have no filesystem. The two must agree document for
// document; search-documents.test.ts pins that against this repository's own openspec/.
//
// This module reads files, so it lives on the package index rather than the browser-safe subpath.

import fs from "node:fs";
import path from "node:path";
import { rootArtifacts } from "./artifact-files.js";
import { discoverSpecFiles } from "./spec-files.js";
import type { SearchResult } from "./types.js";
import { searchDocuments, specSearchDocument, type SearchDocument } from "./search.js";

/** Directory entries, minus dot entries, in filesystem order. Missing directory reads as empty. */
function readDir(dirPath: string): fs.Dirent[] {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath, { withFileTypes: true }).filter((e) => !e.name.startsWith("."));
}

function collectChanges(
  baseDir: string,
  status: "active" | "archived",
  out: SearchDocument[],
): void {
  for (const entry of readDir(baseDir)) {
    if (!entry.isDirectory() || entry.name === "archive") continue;
    const changePath = path.join(baseDir, entry.name);
    for (const { file } of rootArtifacts(changePath)) {
      out.push({
        type: "change",
        name: entry.name,
        file,
        text: fs.readFileSync(path.join(changePath, file), "utf-8"),
        status,
      });
    }
  }
}

/**
 * Every document in a repository's search corpus.
 *
 * Specs, then active changes, then archived changes — but the order documents arrive in only decides
 * which one answers a name-only match within a change. The order of the *results* is the search rule's,
 * not this list's.
 *
 * The change's delta `specs/` tree is not indexed: its content is the delta of a main spec that is itself
 * indexed, so indexing it would list the same text under two names.
 */
export function collectSearchDocuments(basePath: string): SearchDocument[] {
  const openspecDir = path.join(basePath, "openspec");
  const documents: SearchDocument[] = [];

  for (const { topic, file } of discoverSpecFiles(path.join(openspecDir, "specs"))) {
    documents.push(specSearchDocument(topic, fs.readFileSync(file, "utf-8")));
  }

  const changesDir = path.join(openspecDir, "changes");
  collectChanges(changesDir, "active", documents);
  collectChanges(path.join(changesDir, "archive"), "archived", documents);

  return documents;
}

/**
 * The corpus plus the rule: what a host with a repository path and a query actually wants. Every
 * file-reading surface calls this and nothing else, so none of them holds a corpus walk of its own.
 */
export function searchRepository(basePath: string, query: string): SearchResult[] {
  return searchDocuments(collectSearchDocuments(basePath), query);
}
