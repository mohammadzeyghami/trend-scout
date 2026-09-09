export type Platform = "youtube" | "instagram" | "tiktok";
export const PLATFORMS: Platform[] = ["youtube", "instagram", "tiktok"];
export const PLATFORM_LABEL: Record<Platform, string> = { youtube: "یوتیوب", instagram: "اینستاگرام", tiktok: "تیک‌تاک" };

/** A post as every provider returns it — the only shape the chain ever sees. */
export interface CollectedPost {
  platform: Platform;
  externalId: string;
  url: string;
  author: string;
  title: string;
  caption: string;
  publishedAt: Date | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  durationSec?: number | null;
  thumbnailUrl?: string | null;
  raw?: unknown;
}

export interface SearchParams {
  queries: string[];
  hashtags: string[];
  since: Date;
  until: Date;
  limit: number;
}

export interface Provider {
  platform: Platform;
  name: string;
  /** Whether the adapter has what it needs (keys) to run. */
  ready(): { ok: boolean; reason?: string };
  search(p: SearchParams): Promise<CollectedPost[]>;
}

export const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

export const inWindow = (d: Date | null, since: Date, until: Date) => !d || (d >= since && d <= until);
