import { useLocation, useNavigate } from "react-router-dom";
import type { Heading } from "@spekjs/core/headings";
import { useScrollspy } from "../hooks/useScrollspy";
import { scrollToAnchorId } from "../utils/scrollOffset";

interface SpecTocProps {
  headings: Heading[];
}

export function SpecToc({ headings }: SpecTocProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const ids = headings.map((h) => h.slug);
  const activeId = useScrollspy(ids);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    e.preventDefault();
    scrollToAnchorId(slug);
    navigate(`${location.pathname}${location.search}#${slug}`, { replace: false });
  };

  return (
    <nav
      aria-label="Table of contents"
      className="sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto text-sm"
    >
      <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        On this page
      </div>
      <ul className="space-y-1 border-l border-border">
        {headings.map((h) => {
          const isActive = activeId === h.slug;
          const indentClass = h.level === 3 ? "pl-6" : "pl-3";
          const activeClass = isActive
            ? "border-l-2 -ml-px border-accent text-accent"
            : "text-text-muted hover:text-text-primary border-l-2 -ml-px border-transparent";
          return (
            <li key={h.slug}>
              <a
                href={`#${h.slug}`}
                onClick={(e) => handleClick(e, h.slug)}
                className={`block py-1 ${indentClass} transition-colors ${activeClass}`}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
