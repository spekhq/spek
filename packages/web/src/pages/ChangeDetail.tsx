import { useEffect, useMemo } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { extractHeadings } from "@spek/core/headings";
import { useChange, useSpecs } from "../hooks/useOpenSpec";
import { TabView } from "../components/TabView";
import { TaskProgress } from "../components/TaskProgress";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { SpecsTabContent } from "../components/SpecsTabContent";
import { SpecToc } from "../components/SpecToc";
import { formatLifecycleBanner, todayIso } from "../utils/lifecycle";

const TAB_IDS = ["proposal", "design", "specs", "tasks"] as const;
type TabId = (typeof TAB_IDS)[number];
const DEFAULT_TAB: TabId = "proposal";
const TOC_MIN_HEADINGS = 3;

function isTabId(value: string | null): value is TabId {
  return value !== null && (TAB_IDS as readonly string[]).includes(value);
}

// 對齊 @spek/core 的 parseSlug：去掉開頭 YYYY-MM-DD- 前綴並把 dash 轉空格
function slugTitle(slug: string): string {
  const m = slug.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  return (m ? m[1] : slug).replace(/-/g, " ");
}

export function ChangeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error } = useChange(slug ?? "");
  const { data: specsData } = useSpecs();
  const specTopics = specsData?.map((s) => s.topic) ?? [];

  const tabParam = searchParams.get("tab");
  const activeTab: TabId = isTabId(tabParam) ? tabParam : DEFAULT_TAB;

  const currentHeadings = useMemo(() => {
    if (!data) return [];
    if (activeTab === "proposal") return data.proposal ? extractHeadings(data.proposal) : [];
    if (activeTab === "design") return data.design ? extractHeadings(data.design) : [];
    if (activeTab === "specs") {
      return data.specs.flatMap((s) =>
        extractHeadings(s.content).map((h) => ({ ...h, slug: `${s.topic}--${h.slug}` })),
      );
    }
    return [];
  }, [data, activeTab]);

  // Tab 切換時：URL 只保留 ?tab=<id>，同步清掉 hash（不同 tab 的舊 heading 已無意義），
  // 並把 window 捲回頂端，避免停留在上一個 tab 的視窗位置。
  const handleTabChange = (id: string) => {
    setSearchParams({ tab: id }, { replace: false });
    if (location.hash) {
      window.history.replaceState(null, "", `${location.pathname}?tab=${id}`);
    }
    window.scrollTo(0, 0);
  };

  // Hash 錨點：在內容就緒 + hash 或 tab 變更時，捲到對應 heading（等 markdown render 完再試）
  useEffect(() => {
    if (!data) return;
    const hash = location.hash.replace(/^#/, "");
    if (!hash) return;

    const HEADER_OFFSET = 80;
    let attempts = 0;
    let rafId: number | null = null;

    const tryScroll = () => {
      const el = document.getElementById(hash);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
        window.scrollTo({ top, behavior: "smooth" });
        return;
      }
      if (attempts++ < 10) {
        rafId = requestAnimationFrame(tryScroll);
      }
    };

    rafId = requestAnimationFrame(tryScroll);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [data, activeTab, location.hash]);

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;
  if (!data) return <p className="text-text-muted">Change not found</p>;

  const tabs = [
    {
      id: "proposal",
      label: "Proposal",
      content: data.proposal ? (
        <MarkdownRenderer content={data.proposal} specTopics={specTopics} />
      ) : (
        <p className="text-text-muted text-sm">No content</p>
      ),
    },
    {
      id: "design",
      label: "Design",
      content: data.design ? (
        <MarkdownRenderer content={data.design} />
      ) : (
        <p className="text-text-muted text-sm">No content</p>
      ),
    },
    {
      id: "specs",
      label: "Specs",
      content:
        data.specs.length > 0 ? (
          <SpecsTabContent specs={data.specs} />
        ) : (
          <p className="text-text-muted text-sm">No delta specs</p>
        ),
    },
    {
      id: "tasks",
      label: "Tasks",
      content: data.tasks ? (
        <div className="space-y-4">
          <TaskProgress completed={data.tasks.completed} total={data.tasks.total} />
          <div className="space-y-4">
            {data.tasks.sections.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-semibold text-text-secondary mb-2">{section.title}</h3>
                <div className="space-y-1">
                  {section.tasks.map((task, i) => (
                    <div key={i} className={`flex items-start gap-2 text-sm ${task.completed ? "opacity-60" : ""}`}>
                      {task.completed ? (
                        <svg className="w-4 h-4 mt-0.5 shrink-0 text-green-400" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.2" />
                          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mt-0.5 shrink-0 text-text-muted" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      )}
                      <span className={task.completed ? "text-text-secondary line-through" : "text-text-primary"}>
                        {task.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-text-muted text-sm">No content</p>
      ),
    },
  ];

  const lifecycleBanner = formatLifecycleBanner(data, todayIso());
  const title = slug ? slugTitle(slug) : "";
  const headerEl = (
    <div className="pt-2 pb-3">
      <Link to="/changes" className="text-text-muted text-base font-medium hover:text-accent transition-colors">
        &larr; Back to Changes
      </Link>
      <h1 className="text-2xl font-bold mt-2" title={slug}>{title}</h1>
      {lifecycleBanner && (
        <p className="text-text-muted text-xs mt-2 mb-1 tracking-wide [word-spacing:0.15em]">{lifecycleBanner}</p>
      )}
    </div>
  );

  const showToc = activeTab !== "tasks" && currentHeadings.length >= TOC_MIN_HEADINGS;

  return (
    <div className={showToc ? "xl:grid xl:grid-cols-[minmax(0,1fr)_16rem] xl:gap-8" : ""}>
      <div className="min-w-0">
        <TabView tabs={tabs} header={headerEl} sticky activeId={activeTab} onChange={handleTabChange} />
      </div>
      {showToc && (
        <aside className="hidden xl:block xl:pt-2">
          <SpecToc key={activeTab} headings={currentHeadings} />
        </aside>
      )}
    </div>
  );
}
