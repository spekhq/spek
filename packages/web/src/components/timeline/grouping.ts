// Timeline lane / grouping 推導：把 ChangeInfo[] 分成 lanes（含 group by topic 變體），
// 缺 createdDate 的 change 獨立提出由 caller 渲染。

import type { ChangeInfo, GraphData } from "@spekjs/core";

export interface LaneItem {
  change: ChangeInfo;
  // 多 topic change 在 group view 中會出現多次。topics 是「該 change 全部影響的 topic」，
  // 用於 tooltip。lane.topic 才是這個 lane 屬於哪個 topic。
  topics: string[];
}

export interface Lane {
  // group view: spec topic；flat view: null
  topic: string | null;
  items: LaneItem[];
}

export interface BuildLanesResult {
  lanes: Lane[];
  unknownCreated: ChangeInfo[];
}

// 從 GraphData 抽出 change → topics 對應。
// scanner.buildGraphData 產出 id 為 `change:${slug}` / `spec:${topic}`，label 為人類描述（非 slug）。
// 解析靠 id prefix；node lookup 確認類型，避免 prefix 撞到別的字串。
function stripPrefix(id: string, prefix: string): string | null {
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
}

export function changeTopicsMap(graph: GraphData | null): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!graph) return map;
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n] as const));
  for (const edge of graph.edges) {
    const a = nodeById.get(edge.source);
    const b = nodeById.get(edge.target);
    if (!a || !b) continue;
    let changeId: string | null = null;
    let specId: string | null = null;
    if (a.type === "change" && b.type === "spec") {
      changeId = a.id;
      specId = b.id;
    } else if (a.type === "spec" && b.type === "change") {
      changeId = b.id;
      specId = a.id;
    }
    if (!changeId || !specId) continue;
    const slug = stripPrefix(changeId, "change:");
    const topic = stripPrefix(specId, "spec:");
    if (!slug || !topic) continue;
    const arr = map.get(slug) ?? [];
    if (!arr.includes(topic)) arr.push(topic);
    map.set(slug, arr);
  }
  // topics 內排序，輸出穩定
  for (const [k, v] of map) {
    map.set(k, [...v].sort());
  }
  return map;
}

function compareCreated(a: ChangeInfo, b: ChangeInfo): number {
  const ad = a.createdDate ?? "";
  const bd = b.createdDate ?? "";
  if (ad === bd) return a.slug.localeCompare(b.slug);
  return ad.localeCompare(bd);
}

// 主 API：把 changes 攤成 lanes。
// - groupByTopic=false：單一 lane，items 依 createdDate 升冪。
// - groupByTopic=true：以 topic 分群，每群內 items 依 createdDate 升冪；多 topic change 在每群各出現一次。
//   無 topic 對應的 change 放進獨立 lane（topic === ""，caller 可顯示為 "(no topic)"）。
// 缺 createdDate 的 change 一律抽到 unknownCreated，不進 lanes。
export function buildLanes(
  changes: ChangeInfo[],
  graph: GraphData | null,
  groupByTopic: boolean,
): BuildLanesResult {
  const unknownCreated: ChangeInfo[] = [];
  const dated: ChangeInfo[] = [];
  for (const c of changes) {
    if (c.createdDate) dated.push(c);
    else unknownCreated.push(c);
  }
  unknownCreated.sort((a, b) => a.slug.localeCompare(b.slug));

  const topicsBySlug = changeTopicsMap(graph);

  if (!groupByTopic) {
    const sorted = [...dated].sort(compareCreated);
    const items: LaneItem[] = sorted.map((c) => ({
      change: c,
      topics: topicsBySlug.get(c.slug) ?? [],
    }));
    return {
      lanes: items.length > 0 ? [{ topic: null, items }] : [],
      unknownCreated,
    };
  }

  // group view
  const byTopic = new Map<string, ChangeInfo[]>();
  for (const c of dated) {
    const topics = topicsBySlug.get(c.slug) ?? [];
    if (topics.length === 0) {
      const arr = byTopic.get("") ?? [];
      arr.push(c);
      byTopic.set("", arr);
    } else {
      for (const t of topics) {
        const arr = byTopic.get(t) ?? [];
        arr.push(c);
        byTopic.set(t, arr);
      }
    }
  }
  const sortedTopics = [...byTopic.keys()].sort((a, b) => {
    if (a === "" && b !== "") return 1;
    if (b === "" && a !== "") return -1;
    return a.localeCompare(b);
  });
  const lanes: Lane[] = sortedTopics.map((topic) => {
    const items = (byTopic.get(topic) ?? [])
      .slice()
      .sort(compareCreated)
      .map((c) => ({ change: c, topics: topicsBySlug.get(c.slug) ?? [] }));
    return { topic: topic === "" ? "" : topic, items };
  });

  return { lanes, unknownCreated };
}
