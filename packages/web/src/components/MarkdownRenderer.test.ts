import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { MarkdownRenderer } from "./MarkdownRenderer";

// MarkdownRenderer 的產出由 react-markdown 決定，無法像 SchemaBadge 那樣直接呼叫函式檢查，
// 故以 renderToStaticMarkup 渲染真實 component 後斷言 DOM。需 MemoryRouter 包裹：
// code override 對 spec topic 會產生 <Link>。副檔名須為 .test.ts（web 的 glob 是
// src/**/*.test.ts，.tsx 不會被收），因此以 createElement 取代 JSX。
//
// 【本檔的能力邊界 —— 讀之前務必知道】
// renderToStaticMarkup 回傳字串，沒有 CSSOM、沒有版面計算。以下測試只能守住
// **結構與 class 的作用域**，不能守住「marker 是否與文字同行」這類幾何結果 ——
// 例如替 checkbox 加上 `block` 會重現原始 bug，而本檔全綠。
// 幾何以瀏覽器實測（見 change 的 tasks.md 5.3，附實測數值），不在此處。
// 幸運的是本 change 修掉的三個 bug 全部是**作用域**錯誤（marker 取消掛錯層級），
// 那正是 class 斷言驗得到的部分。
function render(content: string): string {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(MarkdownRenderer, { content }))
  );
}

const ulClass = (html: string) => /<ul class="([^"]*)"/.exec(html)?.[1] ?? "";
const olClass = (html: string) => /<ol class="([^"]*)"/.exec(html)?.[1] ?? "";
// 取出所有 <li ...> 的 class（依出現順序）
const liClasses = (html: string) =>
  [...html.matchAll(/<li class="([^"]*)"/g)].map((m) => m[1]);

test("MarkdownRenderer: task list keeps remark-gfm 的 class hook", () => {
  // 這正是原本壞掉的點：ul / li override 只解構 children，class 被丟棄，
  // 於是 contains-task-list / task-list-item 從未進 DOM，CSS 無從掛載。
  const html = render("- [ ] open\n- [x] done\n");
  assert.match(html, /<ul class="[^"]*contains-task-list/, "ul 應帶 contains-task-list");
  assert.match(html, /<li class="[^"]*task-list-item/, "li 應帶 task-list-item");
});

test("MarkdownRenderer: marker 的取消以項目為單位，不以容器為單位", () => {
  // 混合清單（task + 一般項目）：容器仍是 list-disc，只有 task item 取消 marker。
  // 若把 list-none 掛在 ul（以 contains-task-list 判定），一般項目會變成沒有任何
  // 前導記號的裸文字 —— 這是本 change 第一版的真實 bug。
  const html = render("- [x] a task\n- a plain bullet\n- [ ] another task\n");
  assert.match(ulClass(html), /\blist-disc\b/, "容器必須保留 list-disc");
  assert.doesNotMatch(ulClass(html), /\blist-none\b/, "容器不得被整個取消 marker");

  const [first, plain, third] = liClasses(html);
  assert.match(first, /\blist-none\b/, "task item 應取消 marker");
  assert.match(first, /\btask-list-item\b/);
  assert.doesNotMatch(plain, /\blist-none\b/, "混合清單中的一般項目必須保留 marker");
  assert.doesNotMatch(plain, /\btask-list-item\b/);
  assert.match(third, /\blist-none\b/);
});

test("MarkdownRenderer: 有序 task list 的數字要被取消，不是被 checkbox 蓋掉", () => {
  // remark-gfm 對 `1. [ ]` 同樣掛 contains-task-list。ol 若保留 list-decimal 而
  // checkbox 又被 -ml-6 拉進同一條溝槽，數字會被 checkbox 蓋住（渲染成 "☐. alpha"）。
  const html = render("1. [ ] ordered task\n2. [x] done\n");
  assert.match(olClass(html), /\blist-decimal\b/, "容器仍宣告 list-decimal");
  for (const li of liClasses(html)) {
    assert.match(li, /\btask-list-item\b/);
    assert.match(li, /\blist-none\b/, "有序 task item 必須逐項取消數字");
  }
});

test("MarkdownRenderer: 一般 list 保留 marker", () => {
  const html = render("- plain one\n- plain two\n");
  assert.match(ulClass(html), /\blist-disc\b/);
  assert.doesNotMatch(html, /contains-task-list/);
  for (const li of liClasses(html)) {
    assert.doesNotMatch(li, /\blist-none\b/);
  }
});

test("MarkdownRenderer: list 一律 list-outside，不得回到 inside 定位", () => {
  // inside 定位會讓 loose list 的 marker 被 block <p> 擠到自己一行（本 change 的 defect 1）。
  // 斷言以 /-inside\b/ 表述而非字面 class token —— Tailwind v4 會掃描原始碼文字（含註解與
  // 測試），字面的 class token 會被當成用到而產生一條 dead rule；`-inside` 不是任何 class。
  const shapes = [
    "- [ ] task\n",
    "- plain\n",
    "- loose\n\n- items\n",
    "1. ordered\n",
    "1. loose ordered\n\n2. second\n", // loose ol：與 loose ul 同樣會踩 inside 定位
  ];
  for (const src of shapes) {
    const html = render(src);
    assert.doesNotMatch(html, /-inside\b/, `inside 定位不應出現於: ${JSON.stringify(src)}`);
    assert.match(html, /\blist-outside\b/, `list-outside 應出現於: ${JSON.stringify(src)}`);
  }
});

test("MarkdownRenderer: checkbox 拉進 marker 溝槽並與首行對齊", () => {
  // -ml-6 與 ul 的 pl-6 成對；缺其一則續行不會對齊首行文字。
  // align-middle 是「checkbox 與首行文字對齊」的唯一實作，必須釘住 —— 否則刪掉它全綠。
  const html = render("- [x] done\n");
  assert.match(html, /<input[^>]*class="[^"]*-ml-6/, "checkbox 應帶 -ml-6");
  assert.match(html, /<input[^>]*class="[^"]*align-middle/, "checkbox 應帶 align-middle");
  assert.match(ulClass(html), /\bpl-6\b/, "ul 應保留 pl-6 溝槽");
});

test("MarkdownRenderer: checkbox 為 inert 但保留 owner 的 accent 配色", () => {
  // readonly 對 checkbox 無效，單獨用會留下可聚焦、可點的幽靈 tab stop。改以 tabIndex=-1
  // （移出 tab 序）+ pointer-events-none（擋滑鼠）達成 inert，且不打灰 accent-accent。
  const html = render("- [ ] open\n- [x] done\n");
  const inputs = [...html.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map((m) => m[0]);
  assert.ok(inputs.length >= 2, "應有兩個 checkbox");
  for (const input of inputs) {
    assert.match(input, /tabindex="-1"/i, "checkbox 應移出 tab 序");
    assert.match(input, /pointer-events-none/, "checkbox 應擋滑鼠互動");
    assert.match(input, /accent-accent/, "checkbox 應保留 owner 的 accent 配色（不打灰）");
    assert.doesNotMatch(input, /\bdisabled\b/, "不應用 disabled（會蓋掉 accent）");
  }
});

test("MarkdownRenderer: 只歸零項目尾段的間距，不歸零段間", () => {
  // [&_li>p]:mb-0 會把同一項目內的多個段落黏成一塊（段間 0px，比項目之間還小）。
  // 必須是 :last-of-type —— 且不能用 :last-child（processChildren 把空白包成 span，
  // li 的子節點是 SPAN,P,SPAN,...，沒有任何 p 會是 :last-child）。
  const html = render("- first para\n\n  second para of SAME item\n\n- item two\n");
  assert.match(ulClass(html), /last-of-type/, "應只歸零 last-of-type 的段落");
  assert.doesNotMatch(ulClass(html), /\[&_li>p\]:mb-0/, "不得歸零項目內全部段落");
  assert.doesNotMatch(ulClass(html), /last-child/, "last-child 在此結構永遠不匹配");
});

test("MarkdownRenderer: loose task list 的內嵌 blockquote 留在同一個 li 內", () => {
  // janitarr retrospective §6 形狀。regex 必須以 </li> 為界且非貪婪 ——
  // 用 /.*<blockquote/s 會跨越整份文件，blockquote 逃到 ul 外也會通過（假斷言）。
  const html = render("- [ ] first\n  > why: because\n\n- [x] second\n  > why: other\n");
  assert.match(
    html,
    /<li class="[^"]*task-list-item[^"]*">(?:(?!<\/li>).)*?<blockquote/s,
    "blockquote 應在 li 內（非貪婪、以 </li> 為界）"
  );
  assert.equal((html.match(/<li /g) ?? []).length, 2, "應為兩個 list item");

  // 反向驗證上面的 regex 真的會拒絕「blockquote 逃到 list 之外」的情況
  const escaped = render("- [ ] first\n- [x] second\n\n> a sibling blockquote\n");
  assert.doesNotMatch(
    escaped,
    /<li class="[^"]*task-list-item[^"]*">(?:(?!<\/li>).)*?<blockquote/s,
    "blockquote 在 li 外時不得誤判為在內"
  );
});

test("MarkdownRenderer: 非 GFM 的 [~] 退化為一般 list item", () => {
  // janitarr 用 [~] 表示 deferred，但 GFM 不視其為 task item —— 釘住這個既有行為，
  // 本 change 不改變它（支援 [~] 需自訂 remark plugin，屬另一個 change）。
  const html = render("- [~] deferred\n");
  assert.doesNotMatch(html, /task-list-item/, "[~] 不應被當成 task item");
  assert.doesNotMatch(html, /<input/, "[~] 不應產生 checkbox");
  assert.match(html, /\[~\]/, "應保留字面 [~]");
  assert.match(ulClass(html), /\blist-disc\b/, "應保留一般 marker");
  assert.doesNotMatch(liClasses(html)[0], /\blist-none\b/, "[~] 項目必須保留 marker");
});
