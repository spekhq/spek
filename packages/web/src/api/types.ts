import type {
  OverviewData,
  SpecInfo,
  SpecDetail,
  SpecVersionContent,
  ChangesData,
  ChangeDetail,
  SearchResult,
  BrowseData,
  DetectData,
  GraphData,
} from "@spekjs/core";

export interface ApiAdapter {
  getOverview(aggregate?: boolean, includeJj?: boolean): Promise<OverviewData>;
  getSpecs(): Promise<SpecInfo[]>;
  getSpec(topic: string): Promise<SpecDetail>;
  getSpecAtChange(topic: string, slug: string): Promise<SpecVersionContent>;
  getChanges(aggregate?: boolean, includeJj?: boolean): Promise<ChangesData>;
  getChange(slug: string, wt?: string): Promise<ChangeDetail>;
  search(query: string): Promise<SearchResult[]>;
  browse(path: string): Promise<BrowseData>;
  detect(path: string): Promise<DetectData>;
  resync(): Promise<void>;
  getGraphData(aggregate?: boolean, includeJj?: boolean): Promise<GraphData>;
}
