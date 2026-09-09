import { env } from "../env";
import { inWindow, num, type CollectedPost, type Provider, type SearchParams } from "./types";

/** Runs an Apify actor synchronously and returns its dataset items. */
async function runActor<T = Record<string, unknown>>(actor: string, input: unknown, timeoutSec = 240): Promise<T[]> {
  const u = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${env.apifyToken}&timeout=${timeoutSec}&format=json&clean=true`;
  const res = await fetch(u, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout((timeoutSec + 30) * 1000),
  });
  if (!res.ok) throw new Error(`Apify ${actor} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T[];
}

const readyIf = () => (env.apifyToken ? { ok: true } : { ok: false, reason: "APIFY_TOKEN is empty" });
const tag = (s: string) => s.replace(/^#/, "").replace(/\s+/g, "").toLowerCase();

/** Instagram through Apify's instagram-scraper: hashtag pages → posts (reels carry play counts). */
export const apifyInstagramProvider: Provider = {
  platform: "instagram",
  name: `apify:${env.apifyInstagramActor}`,
  ready: readyIf,
  async search({ queries, hashtags, since, until, limit }: SearchParams) {
    const tags = [...new Set([...hashtags, ...queries].map(tag).filter(Boolean))].slice(0, 6);
    const items = await runActor(env.apifyInstagramActor, {
      directUrls: tags.map((t) => `https://www.instagram.com/explore/tags/${encodeURIComponent(t)}/`),
      resultsType: "posts",
      resultsLimit: Math.ceil((limit * 2) / Math.max(1, tags.length)),
      addParentData: false,
    });
    const out: CollectedPost[] = [];
    for (const it of items as Record<string, unknown>[]) {
      const id = String(it.shortCode ?? it.id ?? "");
      if (!id) continue;
      const publishedAt = it.timestamp ? new Date(String(it.timestamp)) : null;
      if (!inWindow(publishedAt, since, until)) continue;
      out.push({
        platform: "instagram",
        externalId: id,
        url: String(it.url ?? `https://www.instagram.com/p/${id}/`),
        author: String(it.ownerUsername ?? ""),
        title: "",
        caption: String(it.caption ?? ""),
        publishedAt,
        views: num(it.videoPlayCount ?? it.videoViewCount ?? 0),
        likes: num(it.likesCount),
        comments: num(it.commentsCount),
        shares: 0,
        durationSec: it.videoDuration ? Math.round(Number(it.videoDuration)) : null,
        thumbnailUrl: (it.displayUrl as string) ?? null,
        raw: { type: it.type, productType: it.productType, hashtags: it.hashtags },
      });
    }
    return out.sort((a, b) => b.views - a.views).slice(0, limit);
  },
};

/** TikTok through Apify's clockworks/tiktok-scraper: keyword search + hashtags. */
export const apifyTiktokProvider: Provider = {
  platform: "tiktok",
  name: `apify:${env.apifyTiktokActor}`,
  ready: readyIf,
  async search({ queries, hashtags, since, until, limit }: SearchParams) {
    const items = await runActor(env.apifyTiktokActor, {
      searchQueries: queries.slice(0, 4),
      hashtags: hashtags.map(tag).filter(Boolean).slice(0, 4),
      resultsPerPage: Math.ceil(limit / 2),
      searchSection: "/video",
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
    });
    const out: CollectedPost[] = [];
    for (const it of items as Record<string, unknown>[]) {
      const id = String(it.id ?? "");
      if (!id) continue;
      const meta = (it.authorMeta ?? {}) as Record<string, unknown>;
      const video = (it.videoMeta ?? {}) as Record<string, unknown>;
      const publishedAt = it.createTimeISO ? new Date(String(it.createTimeISO)) : it.createTime ? new Date(Number(it.createTime) * 1000) : null;
      if (!inWindow(publishedAt, since, until)) continue;
      out.push({
        platform: "tiktok",
        externalId: id,
        url: String(it.webVideoUrl ?? `https://www.tiktok.com/@${meta.name ?? "user"}/video/${id}`),
        author: String(meta.name ?? meta.nickName ?? ""),
        title: "",
        caption: String(it.text ?? ""),
        publishedAt,
        views: num(it.playCount),
        likes: num(it.diggCount),
        comments: num(it.commentCount),
        shares: num(it.shareCount),
        durationSec: video.duration ? Math.round(Number(video.duration)) : null,
        thumbnailUrl: (video.coverUrl as string) ?? null,
        raw: { hashtags: it.hashtags, musicMeta: it.musicMeta },
      });
    }
    return out.sort((a, b) => b.views - a.views).slice(0, limit);
  },
};
