export * from "./size-engine";
export * from "./vibe-analysis";
export * from "./topic-queries";
export * from "./rank-select";
export * from "./curator-prompt";

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
