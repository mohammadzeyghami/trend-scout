import type { StepKey } from "../agents/constants";
import type { TraceEntry } from "../agents/context";
import type { Platform } from "../providers/types";

export type TopicCard = { kind: "topic"; title: string; niche: string; language: string; platforms: string[]; windowFrom: string; windowTo: string };
export type PlanCard = { kind: "plan"; queries: string[]; hashtags: string[]; angles: string[] };

export type PostCard = {
  kind: "post";
  id: string; // Post row id
  platform: Platform;
  url: string;
  author: string;
  title: string;
  caption: string;
  publishedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  durationSec: number | null;
  thumbnailUrl: string | null;
  hasTranscript?: boolean;
  // Ranker
  viewsPerDay?: number;
  engagement?: number;
  relevance?: number;
  relevanceReason?: string;
  score?: number;
  rank?: number;
  // Selector
  selected?: boolean;
  selectReason?: string;
};

export type ExtractCard = Omit<PostCard, "kind"> & {
  kind: "extract";
  source: "transcript" | "caption";
  sourceText: string;
  angle: string;
  whyItWorked: string;
  hook: string;
  structure: string[];
  keyPoints: string[];
};

export type ScriptBeat = { time: string; voice: string; visual: string };
export type ScriptCard = {
  kind: "script";
  scriptId?: string;
  sourcePostIds: string[];
  sourceUrl: string;
  sourcePlatform: Platform;
  title: string;
  hook: string;
  body: ScriptBeat[];
  cta: string;
  onScreenText: string[];
  captions: string[];
  hashtags: string[];
  notes: string;
  wordCount: number;
};

export type Card = TopicCard | PlanCard | PostCard | ExtractCard | ScriptCard;

export type StepStatus = "pending" | "running" | "done" | "failed" | "waiting";
export type StepRecord = {
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  notes: string[];
  input: Card[];
  output: Card[];
};
export type Steps = Partial<Record<StepKey, StepRecord>>;
export type { TraceEntry };

export const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export const scriptWordCount = (c: Pick<ScriptCard, "hook" | "body" | "cta">) =>
  countWords(c.hook) + c.body.reduce((n, b) => n + countWords(b.voice), 0) + countWords(c.cta);
