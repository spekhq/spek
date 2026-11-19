import { useCallback, useState } from "react";
import type { SpecTreeNode } from "@spekjs/core/spec-topic";

const KEY_PREFIX = "spek:spec-tree-collapsed:";

/** Returns the storage to use. A getter, because touching `localStorage` itself can throw. */
export type StorageGetter = () => Pick<Storage, "getItem" | "setItem">;

const browserStorage: StorageGetter = () => localStorage;

/**
 * Every folder path that can fold — a node with children, whether or not it holds its own spec. Pass the
 * **unfiltered** tree: this is what writes are pruned to, so a filtered tree would forget the rest.
 */
export function foldablePaths<T>(nodes: readonly SpecTreeNode<T>[]): string[] {
  const out: string[] = [];
  const walk = (level: readonly SpecTreeNode<T>[]) => {
    for (const node of level) {
      if (node.children.length === 0) continue;
      out.push(node.path);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/**
 * The folders collapsed in [repoPath]. Folder paths mean something only within one repository, and every
 * VS Code window shares one webview origin, so the key carries the repository. Anything unreadable — no
 * storage, a throwing getter, a value that is not a JSON array of strings — is "nothing collapsed".
 */
export function readCollapsed(getStorage: StorageGetter, repoPath: string): Set<string> {
  try {
    const raw = getStorage().getItem(KEY_PREFIX + repoPath);
    if (raw === null) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((p) => typeof p === "string")) return new Set();
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

/** Stores [paths] for [repoPath]; a storage that throws leaves the state to this session. */
export function writeCollapsed(getStorage: StorageGetter, repoPath: string, paths: ReadonlySet<string>): void {
  try {
    getStorage().setItem(KEY_PREFIX + repoPath, JSON.stringify([...paths]));
  } catch {
    // ignore: the state applies to this session only
  }
}

export type CollapseAction = { kind: "toggle"; path: string } | { kind: "collapseAll" } | { kind: "expandAll" };

/**
 * The set after [action], pruned to [foldable] — which is how a folder since renamed or removed leaves the
 * stored set. Called only for a write the reader caused, so a tree still loading, empty or filtered can
 * never wash the stored set out.
 */
export function nextCollapsed(
  current: ReadonlySet<string>,
  action: CollapseAction,
  foldable: readonly string[],
): Set<string> {
  const allowed = new Set(foldable);
  switch (action.kind) {
    case "collapseAll":
      return allowed;
    case "expandAll":
      return new Set();
    case "toggle": {
      const next = new Set([...current].filter((p) => allowed.has(p)));
      if (current.has(action.path)) next.delete(action.path);
      else if (allowed.has(action.path)) next.add(action.path);
      return next;
    }
  }
}

export interface SpecTreeCollapsed {
  collapsed: ReadonlySet<string>;
  toggle: (path: string) => void;
  collapseAll: () => void;
  expandAll: () => void;
}

/**
 * The Specs page's collapsed folders for [repoPath], remembered in `localStorage`. Read once: no host
 * changes `repoPath` while the page is mounted (the Web app switches repository only through `/`, outside
 * `Layout`; the other entries render the router after `repoPath` is set).
 */
export function useSpecTreeCollapsed(
  repoPath: string,
  foldable: readonly string[],
  getStorage: StorageGetter = browserStorage,
): SpecTreeCollapsed {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => readCollapsed(getStorage, repoPath));

  const apply = useCallback(
    (action: CollapseAction) =>
      setCollapsed((current) => {
        const next = nextCollapsed(current, action, foldable);
        writeCollapsed(getStorage, repoPath, next);
        return next;
      }),
    [foldable, getStorage, repoPath],
  );

  return {
    collapsed,
    toggle: useCallback((path: string) => apply({ kind: "toggle", path }), [apply]),
    collapseAll: useCallback(() => apply({ kind: "collapseAll" }), [apply]),
    expandAll: useCallback(() => apply({ kind: "expandAll" }), [apply]),
  };
}
