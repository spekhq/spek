import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { SpecInfo } from "@spekjs/core";
import { buildSpecTree, pruneSpecTree, specRoute, type SpecTreeNode } from "@spekjs/core/spec-topic";

interface SpecTreeProps {
  specs: SpecInfo[];
  /** Case-insensitive substring of the full topic. Matches keep the folders above them. */
  filter: string;
  /** Folder paths the reader collapsed. Owned by the caller, which remembers it per repository. */
  collapsed: ReadonlySet<string>;
  onToggle: (path: string) => void;
}

/**
 * The Specs page's folder tree. A folder holding its own spec is a link and an expandable parent at
 * once; a folder without one only groups, and its name is part of its toggle. Every label is one
 * segment, so the full topic rides along as the title — two folders may each hold a `pagination`.
 */
export function SpecTree({ specs, filter, collapsed, onToggle }: SpecTreeProps) {
  const nodes = useMemo(() => {
    const tree = buildSpecTree(specs);
    const needle = filter.toLowerCase();
    return needle ? pruneSpecTree(tree, (s) => s.topic.toLowerCase().includes(needle)) : tree;
  }, [specs, filter]);

  if (nodes.length === 0) return <p className="text-text-muted text-sm">No specs found</p>;

  // A filter shows every match, so it opens whatever it kept, and its toggles are inert: a collapse
  // recorded now would only surface once the filter is cleared.
  const filtering = filter !== "";
  const isOpen = (path: string) => filtering || !collapsed.has(path);

  return <SpecTreeLevel nodes={nodes} isOpen={isOpen} toggle={onToggle} filtering={filtering} />;
}

function SpecTreeLevel({ nodes, isOpen, toggle, filtering }: {
  nodes: SpecTreeNode<SpecInfo>[];
  isOpen: (path: string) => boolean;
  toggle: (path: string) => void;
  filtering: boolean;
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => {
        const open = isOpen(node.path);
        const hasChildren = node.children.length > 0;
        return (
          <li key={node.path}>
            <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-border rounded hover:border-accent transition-colors">
              {hasChildren && !node.spec ? (
                // A grouping folder: the whole label toggles, since there is no spec for it to open.
                <button
                  type="button"
                  onClick={() => toggle(node.path)}
                  disabled={filtering}
                  aria-expanded={open}
                  title={node.path}
                  className="flex-1 flex items-center gap-2 text-left text-text-muted enabled:hover:text-accent"
                >
                  <span className="w-4" aria-hidden="true">{open ? "▾" : "▸"}</span>
                  {node.name}
                </button>
              ) : (
                <>
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => toggle(node.path)}
                      disabled={filtering}
                      aria-expanded={open}
                      aria-label={`${open ? "Collapse" : "Expand"} ${node.path}`}
                      className="w-4 text-text-muted enabled:hover:text-accent"
                    >
                      {open ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span className="w-4" aria-hidden="true" />
                  )}
                  {node.spec ? (
                    <Link to={specRoute(node.spec.topic)} title={node.path} className="flex-1 text-text-primary font-medium hover:text-accent">
                      {node.name}
                    </Link>
                  ) : (
                    // Unreachable today (a node without a spec always has children), kept so a leaf
                    // without one could never render as nothing.
                    <span title={node.path} className="flex-1 text-text-muted">
                      {node.name}
                    </span>
                  )}
                </>
              )}
              {node.spec && node.spec.historyCount > 0 && (
                <span className="text-text-muted text-xs">
                  {node.spec.historyCount} {node.spec.historyCount === 1 ? "change" : "changes"}
                </span>
              )}
            </div>
            {hasChildren && open && (
              <div className="pl-6 mt-1">
                <SpecTreeLevel nodes={node.children} isOpen={isOpen} toggle={toggle} filtering={filtering} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
