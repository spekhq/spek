import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { type ReactNode } from "react";
import { slugifyHeading } from "@spekjs/core/headings";

// rehype plugin：為 h2/h3 加上 deterministic id（與 extractHeadings 的 slug 演算法一致）。
// 在 hast 階段處理可避免 React Strict Mode 的 double render 讓 counter 翻倍。
type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function hastToText(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  if (node.children) return node.children.map(hastToText).join("");
  return "";
}

function rehypeSpekHeadingIds(options?: { idPrefix?: string }) {
  const prefix = options?.idPrefix ?? "";
  return (tree: HastNode) => {
    const counter = new Map<string, number>();
    const walk = (node: HastNode) => {
      if (
        node.type === "element" &&
        (node.tagName === "h2" || node.tagName === "h3")
      ) {
        const base = slugifyHeading(hastToText(node).trim());
        if (base) {
          const n = counter.get(base) ?? 0;
          counter.set(base, n + 1);
          const dedup = n === 0 ? base : `${base}-${n + 1}`;
          node.properties = node.properties ?? {};
          node.properties.id = `${prefix}${dedup}`;
        }
      }
      if (node.children) for (const child of node.children) walk(child);
    };
    walk(tree);
  };
}

interface MarkdownRendererProps {
  content: string;
  specTopics?: string[];
  // 給 ChangeDetail Specs tab 使用：多份 delta spec 合併時以 `<topic>--` 前綴避免 id 衝突
  idPrefix?: string;
}

// BDD 關鍵字樣式對應
const BDD_KEYWORDS: Record<string, string> = {
  WHEN: "bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-sm font-semibold",
  GIVEN: "bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-sm font-semibold",
  THEN: "bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-sm font-semibold",
  AND: "bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded text-sm font-semibold",
  MUST: "text-red-400 font-bold",
  SHALL: "text-red-400 font-bold",
  ADDED: "bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded text-xs font-semibold",
  MODIFIED: "bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-xs font-semibold",
};

const BDD_PATTERN = new RegExp(
  `\\b(${Object.keys(BDD_KEYWORDS).join("|")})\\b`,
  "g"
);

function highlightBddKeywords(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  BDD_PATTERN.lastIndex = 0;
  while ((match = BDD_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const keyword = match[1];
    parts.push(
      <span key={match.index} className={BDD_KEYWORDS[keyword]}>
        {keyword}
      </span>
    );
    lastIndex = BDD_PATTERN.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function processChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") {
    return highlightBddKeywords(children);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === "string" ? (
        <span key={i}>{highlightBddKeywords(child)}</span>
      ) : (
        child
      )
    );
  }
  return children;
}

// marker 溝槽寬度：ul/ol 的左內距與 checkbox 的負左邊距必須是同一個量（後者為前者的負值），
// checkbox 才會精準落在 marker 溝槽。兩個字面值集中於此，改一個務必改另一個。
const LIST_GUTTER_PAD = "pl-6"; // ul / ol 左內距（marker 溝槽）
const LIST_GUTTER_PULL = "-ml-6"; // checkbox 負左邊距（＝ LIST_GUTTER_PAD 的負值，見 input override）

// ul / ol 共用的 list 樣式，集中一處避免兩邊各自漂移：
// - list-outside（而非 inside 定位）：把 marker 放進內容流時，loose list（項目間有空行）的
//   項目內容被 remark 包成 block <p>，block 無法與 inline marker 共用 line box，marker 因此被
//   擠到自己一行。outside 讓 marker 待在內容盒外，與首行同列，續行自動 hanging indent。
// - [&_li>p:last-of-type]:mb-0：p override 的 mb-4 會在項目尾端多出一段空隙，使單一項目讀起來
//   像數段。只歸零每個項目的最後一段 —— 不可歸零全部：同一項目內若有多個段落，段間仍需要 mb-4，
//   否則兩段黏成一塊、間距反而比項目之間還小。亦不可用 :last-child —— processChildren 會把空白
//   包成 <span>，li 的子節點是 SPAN,P,SPAN,... 沒有任何 p 會是 :last-child。
const LIST_BASE = `list-outside ${LIST_GUTTER_PAD} mb-4 space-y-1 [&_li>p:last-of-type]:mb-0`;

export function MarkdownRenderer({ content, specTopics, idPrefix }: MarkdownRendererProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSpekHeadingIds, { idPrefix }]]}
        components={{
          // 段落：套用 BDD 高亮
          p({ children }) {
            return <p className="mb-4 leading-relaxed">{processChildren(children)}</p>;
          },
          // 列表項：套用 BDD 高亮。className 需向下傳遞，remark-gfm 的 task-list-item
          // 才會抵達 DOM（原本只解構 children，class 被丟棄，樣式無從掛載）。
          //
          // marker 的取消必須以「項目」為單位，不能以「容器」為單位 —— remark-gfm 只要
          // list 內有任一 task item 就會在容器掛上 contains-task-list，但 task-list-item
          // 是逐項的。若在 ul 上取消 marker，混合清單（task + 一般項目並存）的一般項目會
          // 連 marker 都沒有，變成沒有任何前導記號的裸文字；ol 的數字也會被 checkbox 蓋掉。
          // 這也是 GitHub 把 list-style: none 掛在 .task-list-item 而非容器上的原因。
          li({ className, children }) {
            const isTaskItem = className?.includes("task-list-item");
            const cls = ["mb-1", isTaskItem ? "list-none" : "", className]
              .filter(Boolean)
              .join(" ");
            return <li className={cls}>{processChildren(children)}</li>;
          },
          // 標題
          h1({ children }) {
            return <h1 className="text-2xl font-bold mt-6 mb-4 text-text-primary">{children}</h1>;
          },
          h2({ id, children }) {
            return <h2 id={id} className="text-xl font-bold mt-6 mb-3 text-text-primary border-b border-border pb-2 scroll-mt-20">{children}</h2>;
          },
          h3({ id, children }) {
            return <h3 id={id} className="text-lg font-semibold mt-5 mb-2 text-text-primary scroll-mt-20">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="text-base font-semibold mt-4 mb-2 text-text-secondary">{children}</h4>;
          },
          h5({ children }) {
            return <h5 className="text-sm font-semibold mt-3 mb-1 text-text-secondary">{children}</h5>;
          },
          h6({ children }) {
            return <h6 className="text-sm font-medium mt-3 mb-1 text-text-muted">{children}</h6>;
          },
          // 強調
          strong({ children }) {
            return <strong className="font-bold text-text-primary">{processChildren(children)}</strong>;
          },
          em({ children }) {
            return <em className="italic text-text-secondary">{children}</em>;
          },
          // 連結
          a({ href, children }) {
            return (
              <a
                href={href}
                className="text-accent hover:text-accent-hover underline transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },
          // 程式碼區塊 — 不做 BDD 高亮
          code({ className, children }) {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return (
                <code className={`${className} block`}>
                  {children}
                </code>
              );
            }
            const text = typeof children === "string" ? children : String(children ?? "");
            if (specTopics?.includes(text)) {
              return (
                <Link
                  to={`/specs/${text}`}
                  className="bg-bg-tertiary text-accent hover:text-accent-hover px-1.5 py-0.5 rounded text-sm underline decoration-dotted transition-colors"
                >
                  {text}
                </Link>
              );
            }
            return (
              <code className="bg-bg-tertiary text-accent px-1.5 py-0.5 rounded text-sm">
                {children}
              </code>
            );
          },
          pre({ children }) {
            return (
              <pre className="bg-bg-tertiary border border-border rounded-lg p-4 text-sm overflow-x-auto mb-4 leading-relaxed">
                {children}
              </pre>
            );
          },
          // 表格
          table({ children }) {
            return (
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full border-collapse border border-border text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-bg-tertiary">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="border border-border px-3 py-2 text-left font-semibold text-text-secondary">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-border px-3 py-2 text-text-primary">
                {children}
              </td>
            );
          },
          // 列表（樣式見 LIST_BASE；marker 的取消在 li override，不在此處）
          ul({ className, children }) {
            return (
              <ul className={[`list-disc ${LIST_BASE}`, className].filter(Boolean).join(" ")}>
                {children}
              </ul>
            );
          },
          ol({ className, children }) {
            return (
              <ol className={[`list-decimal ${LIST_BASE}`, className].filter(Boolean).join(" ")}>
                {children}
              </ol>
            );
          },
          // 分隔線
          hr() {
            return <hr className="border-border my-6" />;
          },
          // 引用
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-accent pl-4 my-4 text-text-secondary italic">
                {children}
              </blockquote>
            );
          },
          // 輸入（checkbox）
          //
          // LIST_GUTTER_PULL（-ml-6）把 checkbox 拉進 ul 的 marker 溝槽（LIST_GUTTER_PAD），
          // 使其後的文字落在內容邊緣、續行以 hanging indent 對齊首行。
          // （remark-gfm 只在 task list item 內產生 checkbox，故負邊距不會誤傷其他情境。）
          //
          // 這是唯讀檢視，checkbox 應為 inert。readonly 對 checkbox 無效（HTML 規範只作用於
          // 文字類 input），單獨用它會留下一個可聚焦、可點的幽靈 tab stop。
          // 不用 disabled —— 它會把 checkbox 打灰、蓋掉 owner 的 accent-accent（琥珀）配色，
          // 屬非必要的視覺改動。改以 tabIndex=-1 移出 tab 序、pointer-events-none 擋滑鼠聚焦／點擊，
          // 外觀不變、互動移除。readOnly 保留以抑制 React「controlled input 缺 onChange」的警告。
          input({ node, ...props }) {
            if (props.type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={props.checked}
                  readOnly
                  tabIndex={-1}
                  className={`w-4 h-4 ${LIST_GUTTER_PULL} mr-2 align-middle accent-accent pointer-events-none`}
                />
              );
            }
            // 非 checkbox（實務上不會出現 —— 沒有 rehype-raw，原始 <input> 會被跳脫成文字）：
            // 原樣轉發所有 prop，不再丟棄 value / name / checked 等。node 是 react-markdown 的
            // ExtraProps、非 DOM 屬性，故排除以免 React 對未知屬性發警告。
            void node;
            return <input {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
