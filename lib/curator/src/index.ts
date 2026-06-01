export * from "./mood-filters";
export * from "./size-engine";
export * from "./vibe-analysis";
export * from "./topic-queries";
export * from "./topic-facets";
export * from "./topic-match";
export * from "./playlist-inspiration";
export * from "./rank-select";
export * from "./curator-prompt";
export * from "./fill-prompt";

export type CuratorBuildMeta = {
  vibe: string;
  tact: string;
  targetSize: number;
  reason?: string;
};

export type CuratorBuildItem = {
  line: string;
  artist: string;
  title: string;
  uid?: string;
  confidence?: number;
  blocked?: boolean;
  blockReason?: string;
};

export type CuratorBuildResult = {
  meta: CuratorBuildMeta;
  lines: string[];
  items: CuratorBuildItem[];
};
