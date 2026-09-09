import type { CollectedPost, Platform, Provider, SearchParams } from "./types";

/** Deterministic fake posts so the whole chain runs without any platform key. */
export function mockProvider(platform: Platform): Provider {
  return {
    platform,
    name: "mock",
    ready: () => ({ ok: true }),
    async search({ queries, since, until, limit }: SearchParams) {
      const out: CollectedPost[] = [];
      const span = Math.max(1, until.getTime() - since.getTime());
      let seed = hash(platform + queries.join("|"));
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      const authors = ["sara.creates", "mediaguy", "tech.farsi", "reza_vlogs", "dailytrend", "nima.talks", "studio.k", "farnaz.diy"];
      for (const q of queries.slice(0, 4)) {
        for (let i = 0; i < Math.ceil(limit / Math.min(4, queries.length)); i++) {
          const id = `${platform.slice(0, 2)}-${hash(q + i).toString(36)}`;
          const publishedAt = new Date(since.getTime() + rnd() * span);
          const views = Math.round(2_000 + rnd() ** 2 * 900_000);
          const angle = ANGLES[Math.floor(rnd() * ANGLES.length)];
          out.push({
            platform,
            externalId: id,
            url: urlFor(platform, id),
            author: authors[Math.floor(rnd() * authors.length)],
            title: `${angle} ${q}`,
            caption: `${angle} ${q} — ${CAPTIONS[Math.floor(rnd() * CAPTIONS.length)]} #${q.replace(/\s+/g, "")}`,
            publishedAt,
            views,
            likes: Math.round(views * (0.02 + rnd() * 0.08)),
            comments: Math.round(views * (0.001 + rnd() * 0.01)),
            shares: Math.round(views * rnd() * 0.01),
            durationSec: 20 + Math.round(rnd() * 70),
            thumbnailUrl: null,
            raw: { mock: true, query: q },
          });
        }
      }
      return out.slice(0, limit);
    },
  };
}

const ANGLES = ["۳ اشتباه رایج در", "راز موفقیت در", "چطور شروع کنیم:", "هیچ‌کس نمی‌گوید درباره‌ی", "۶۰ ثانیه درباره‌ی", "تجربه‌ی واقعی من از"];
const CAPTIONS = [
  "این ویدیو را تا آخر ببینید، نکته‌ی آخر مهم‌ترین است.",
  "نظرتان را در کامنت بنویسید.",
  "قسمت دوم را هم گذاشتم، پروفایل را ببینید.",
  "این را ذخیره کنید تا بعداً به کارتان بیاید.",
];

function urlFor(p: Platform, id: string) {
  if (p === "youtube") return `https://www.youtube.com/watch?v=${id}`;
  if (p === "instagram") return `https://www.instagram.com/reel/${id}/`;
  return `https://www.tiktok.com/@mock/video/${id}`;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}
