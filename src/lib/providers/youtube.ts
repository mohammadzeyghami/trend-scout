import { env } from "../env";
import { inWindow, num, type CollectedPost, type Provider, type SearchParams } from "./types";

const API = "https://www.googleapis.com/youtube/v3";

/** Official YouTube Data API v3: search.list per query, then videos.list for statistics. */
export const youtubeProvider: Provider = {
  platform: "youtube",
  name: "youtube-data-api",
  ready: () => (env.youtubeKey ? { ok: true } : { ok: false, reason: "YOUTUBE_API_KEY is empty" }),
  async search({ queries, since, until, limit }: SearchParams) {
    const ids = new Set<string>();
    for (const q of queries.slice(0, 5)) {
      const u = new URL(`${API}/search`);
      u.search = new URLSearchParams({
        part: "snippet", type: "video", q, maxResults: "25", order: "relevance",
        publishedAfter: since.toISOString(), publishedBefore: until.toISOString(), key: env.youtubeKey,
      }).toString();
      const res = await fetch(u, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`YouTube search ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      for (const it of data.items ?? []) if (it.id?.videoId) ids.add(it.id.videoId);
      if (ids.size >= limit * 2) break;
    }
    const out: CollectedPost[] = [];
    const all = [...ids];
    for (let i = 0; i < all.length; i += 50) {
      const u = new URL(`${API}/videos`);
      u.search = new URLSearchParams({ part: "snippet,statistics,contentDetails", id: all.slice(i, i + 50).join(","), key: env.youtubeKey }).toString();
      const res = await fetch(u, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`YouTube videos ${res.status}`);
      const data = await res.json();
      for (const v of data.items ?? []) {
        const publishedAt = v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null;
        if (!inWindow(publishedAt, since, until)) continue;
        out.push({
          platform: "youtube",
          externalId: v.id,
          url: `https://www.youtube.com/watch?v=${v.id}`,
          author: v.snippet?.channelTitle ?? "",
          title: v.snippet?.title ?? "",
          caption: v.snippet?.description ?? "",
          publishedAt,
          views: num(v.statistics?.viewCount),
          likes: num(v.statistics?.likeCount),
          comments: num(v.statistics?.commentCount),
          shares: 0,
          durationSec: isoDuration(v.contentDetails?.duration),
          thumbnailUrl: v.snippet?.thumbnails?.high?.url ?? v.snippet?.thumbnails?.default?.url ?? null,
          raw: { statistics: v.statistics, tags: v.snippet?.tags },
        });
      }
    }
    return out.sort((a, b) => b.views - a.views).slice(0, limit);
  },
};

function isoDuration(d?: string): number | null {
  if (!d) return null;
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d);
  if (!m) return null;
  return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
}
