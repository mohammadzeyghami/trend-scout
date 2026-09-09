import type { Project, Topic } from "@prisma/client";
import type { AgentContext } from "../agents/context";
import { db } from "../db";
import { env } from "../env";
import { getProvider } from "../providers";
import { PLATFORM_LABEL, type CollectedPost, type Platform } from "../providers/types";
import { engagementRate, finalScore, viewsPerDay } from "./scoring";
import { fetchTranscript } from "./transcript";
import { scriptWordCount, type ExtractCard, type PlanCard, type PostCard, type ScriptCard, type TopicCard } from "./types";

export type StepEnv = { topic: Topic; project: Project; ctx: AgentContext; notes: string[]; refresh: boolean };

const fmt = (n: number) => new Intl.NumberFormat("en").format(Math.round(n));
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);

export function topicCard(topic: Topic, project: Project): TopicCard {
  return { kind: "topic", title: topic.title, niche: project.niche, language: project.language, platforms: project.platforms, windowFrom: topic.windowFrom.toISOString(), windowTo: topic.windowTo.toISOString() };
}

// ---------------------------------------------------------------- 1. Planner
export async function runPlanner(e: StepEnv): Promise<PlanCard> {
  const { topic, project } = e;
  const r = await e.ctx.callJson<{ queries?: unknown; hashtags?: unknown; angles?: unknown }>(
    "planner",
    `Topic: ${topic.title}\nNiche: ${project.niche || "-"}\nCreator language: ${project.language}\nPlatforms: ${project.platforms.join(", ")}`,
  );
  const queries = arr(r.queries);
  return {
    kind: "plan",
    queries: queries.length ? queries.slice(0, 10) : [topic.title],
    hashtags: arr(r.hashtags).map((h) => h.replace(/^#/, "").replace(/\s+/g, "")).slice(0, 8),
    angles: arr(r.angles).slice(0, 6),
  };
}

/** What the chain uses when the Planner failed: the bare title. */
export const fallbackPlan = (topic: Topic): PlanCard => ({ kind: "plan", queries: [topic.title], hashtags: [topic.title.replace(/\s+/g, "")], angles: [] });

// -------------------------------------------------------------- 2. Collector
export async function runCollector(e: StepEnv, plan: PlanCard): Promise<PostCard[]> {
  const { topic, project } = e;
  const since = topic.windowFrom, until = topic.windowTo;
  const cached = await cachedPosts(topic.id, since, until);
  if (!e.refresh && cached.length >= 10) {
    e.notes.push(`از کش: ${cached.length} پست در بازه (بدون فراخوانی پلتفرم)`);
    return cached;
  }
  const params = { queries: plan.queries, hashtags: plan.hashtags, since, until, limit: env.maxPostsPerPlatform };
  const results = await Promise.allSettled(
    (project.platforms as Platform[]).map(async (platform) => {
      const p = getProvider(platform);
      const ready = p.ready();
      if (!ready.ok) throw new Error(`${PLATFORM_LABEL[platform]}: ${ready.reason}`);
      const posts = await p.search(params);
      e.notes.push(`${PLATFORM_LABEL[platform]} (${p.name}): ${posts.length} پست`);
      return posts;
    }),
  );
  const collected: CollectedPost[] = [];
  let failures = 0;
  for (const r of results) {
    if (r.status === "fulfilled") collected.push(...r.value);
    else { failures++; e.notes.push(`خطا: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`); }
  }
  if (failures === results.length && cached.length === 0) throw new Error("no platform returned anything");
  const fresh = await upsertPosts(topic.id, collected);
  const byId = new Map<string, PostCard>();
  for (const c of [...cached, ...fresh]) byId.set(c.id, c);
  const out = [...byId.values()];
  e.notes.push(`مجموع یکتا: ${out.length} پست`);
  return out;
}

async function cachedPosts(topicId: string, since: Date, until: Date): Promise<PostCard[]> {
  const links = await db.topicPost.findMany({ where: { topicId } });
  if (!links.length) return [];
  const rows = await db.post.findMany({ where: { id: { in: links.map((l) => l.postId) }, OR: [{ publishedAt: null }, { publishedAt: { gte: since, lte: until } }] } });
  return rows.map(toCard);
}

async function upsertPosts(topicId: string, posts: CollectedPost[]): Promise<PostCard[]> {
  const out: PostCard[] = [];
  const seen = new Set<string>();
  for (const p of posts) {
    const k = `${p.platform}:${p.externalId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const data = { url: p.url, author: p.author, title: p.title, caption: p.caption, publishedAt: p.publishedAt, views: p.views, likes: p.likes, comments: p.comments, shares: p.shares, durationSec: p.durationSec ?? null, thumbnailUrl: p.thumbnailUrl ?? null, raw: (p.raw ?? undefined) as object | undefined, fetchedAt: new Date() };
    const row = await db.post.upsert({ where: { platform_externalId: { platform: p.platform, externalId: p.externalId } }, create: { platform: p.platform, externalId: p.externalId, ...data }, update: data });
    await db.topicPost.upsert({ where: { topicId_postId: { topicId, postId: row.id } }, create: { topicId, postId: row.id }, update: {} });
    out.push(toCard(row));
  }
  return out;
}

export function toCard(r: { id: string; platform: string; url: string; author: string; title: string; caption: string; publishedAt: Date | null; views: number; likes: number; comments: number; shares: number; durationSec: number | null; thumbnailUrl: string | null; transcript: string | null }): PostCard {
  return { kind: "post", id: r.id, platform: r.platform as Platform, url: r.url, author: r.author, title: r.title, caption: r.caption, publishedAt: r.publishedAt?.toISOString() ?? null, views: r.views, likes: r.likes, comments: r.comments, shares: r.shares, durationSec: r.durationSec, thumbnailUrl: r.thumbnailUrl, hasTranscript: !!r.transcript };
}

// ----------------------------------------------------------------- 3. Ranker
export async function runRanker(e: StepEnv, posts: PostCard[]): Promise<PostCard[]> {
  if (!posts.length) return [];
  const now = Date.now();
  const cards = posts.map((p) => ({ ...p, viewsPerDay: viewsPerDay(p, now), engagement: engagementRate(p), relevance: 5, relevanceReason: "" }));
  const relevance = new Map<number, { relevance: number; reason: string }>();
  const BATCH = 25;
  const batches: PostCard[][] = [];
  for (let i = 0; i < cards.length; i += BATCH) batches.push(cards.slice(i, i + BATCH));
  const results = await Promise.allSettled(
    batches.map((slice, b) =>
      e.ctx.callJson<{ items?: { index: number; relevance: number; reason?: string }[] }>(
        "ranker",
        `Topic: ${e.topic.title}\nNiche: ${e.project.niche || "-"}\nCreator language: ${e.project.language}\n\nPosts:\n` +
          JSON.stringify(slice.map((p, j) => ({ index: b * BATCH + j, platform: p.platform, title: short(p.title, 120), caption: short(p.caption, 300) }))),
      ),
    ),
  );
  let failed = 0;
  for (const r of results) {
    if (r.status === "rejected") { failed++; continue; }
    for (const it of r.value.items ?? []) if (typeof it.index === "number") relevance.set(it.index, { relevance: Number(it.relevance) || 0, reason: String(it.reason ?? "") });
  }
  if (failed) e.notes.push(`${failed} از ${batches.length} دسته‌ی ربط موضوعی از مدل نگرفتیم؛ آن‌ها ۵/۱۰`);
  const maxLog = Math.max(...cards.map((c) => Math.log10(1 + (c.viewsPerDay ?? 0))), 0);
  cards.forEach((c, i) => {
    const rel = relevance.get(i);
    if (rel) { c.relevance = rel.relevance; c.relevanceReason = rel.reason; }
    c.score = finalScore(c.viewsPerDay ?? 0, maxLog, c.engagement ?? 0, c.relevance ?? 5);
  });
  cards.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  cards.forEach((c, i) => (c.rank = i + 1));
  e.notes.push(`${cards.length} پست رتبه‌بندی شد؛ بالاترین: ${fmt(cards[0].viewsPerDay ?? 0)} ویو/روز`);
  return cards;
}

// --------------------------------------------------------------- 4. Selector
export async function autoSelect(e: StepEnv, ranked: PostCard[]): Promise<PostCard[]> {
  const n = Math.max(1, Math.min(e.project.maxSelected, ranked.length));
  const pool = ranked.slice(0, Math.min(12, ranked.length));
  try {
    const r = await e.ctx.callJson<{ items?: { index: number; reason?: string }[] }>(
      "selector",
      `Topic: ${e.topic.title}\nNiche: ${e.project.niche || "-"}\nCreator language: ${e.project.language}\nPick: ${n}\n\nCandidates:\n` +
        JSON.stringify(pool.map((p, i) => ({ index: i, platform: p.platform, score: p.score, viewsPerDay: Math.round(p.viewsPerDay ?? 0), relevance: p.relevance, title: short(p.title, 120), caption: short(p.caption, 240) }))),
    );
    const picks = (r.items ?? []).filter((it) => typeof it.index === "number" && pool[it.index]).slice(0, n);
    if (picks.length) {
      e.notes.push(`انتخاب خودکار: ${picks.length} پست`);
      return picks.map((it) => ({ ...pool[it.index], selected: true, selectReason: String(it.reason ?? "") }));
    }
  } catch (err) {
    e.notes.push(`مدل انتخاب نکرد (${err instanceof Error ? err.message : err}); ${n} پست برتر برداشته شد`);
  }
  return ranked.slice(0, n).map((p) => ({ ...p, selected: true, selectReason: "بالاترین امتیاز" }));
}

export function manualSelect(ranked: PostCard[], postIds: string[]): PostCard[] {
  const wanted = new Set(postIds);
  return ranked.filter((p) => wanted.has(p.id)).map((p) => ({ ...p, selected: true, selectReason: "انتخاب کاربر" }));
}

// -------------------------------------------------------------- 5. Extractor
export async function runExtractor(e: StepEnv, selected: PostCard[], plan: PlanCard | undefined): Promise<ExtractCard[]> {
  const items = selected.slice(0, 8);
  const angles = plan?.angles ?? [];
  return Promise.all(
    items.map(async (p, i): Promise<ExtractCard> => {
      const row = await db.post.findUnique({ where: { id: p.id } });
      let transcript = row?.transcript ?? null;
      if (!transcript) {
        transcript = await fetchTranscript(p.platform, p.url);
        if (transcript) await db.post.update({ where: { id: p.id }, data: { transcript } });
      }
      const source: ExtractCard["source"] = transcript ? "transcript" : "caption";
      const sourceText = transcript ?? [p.title, p.caption].filter(Boolean).join("\n");
      const angle = angles[i % Math.max(1, angles.length)] ?? "";
      const base: ExtractCard = { ...p, kind: "extract", source, sourceText: short(sourceText, 6000), angle, whyItWorked: "", hook: "", structure: [], keyPoints: [] };
      try {
        const r = await e.ctx.callJson<{ whyItWorked?: string; hook?: string; structure?: unknown; keyPoints?: unknown }>(
          "extractor",
          `Topic: ${e.topic.title}\nCreator language: ${e.project.language}\nPlatform: ${p.platform}\nViews: ${fmt(p.views)} · ${fmt(p.viewsPerDay ?? 0)}/day · likes ${fmt(p.likes)} · comments ${fmt(p.comments)}\nSource (${source}):\n${base.sourceText}`,
        );
        return { ...base, whyItWorked: String(r.whyItWorked ?? ""), hook: String(r.hook ?? ""), structure: arr(r.structure), keyPoints: arr(r.keyPoints) };
      } catch (err) {
        e.notes.push(`تحلیل ${p.platform} ${p.url} شکست خورد: ${err instanceof Error ? err.message : err}`);
        return base;
      }
    }),
  );
}

// ----------------------------------------------------------------- 6. Writer
export async function runWriter(e: StepEnv, extracts: ExtractCard[]): Promise<ScriptCard[]> {
  const results = await Promise.allSettled(
    extracts.map(async (x) => {
      const r = await e.ctx.callJson<Partial<ScriptCard>>(
        "writer",
        `Topic: ${e.topic.title}\nNiche: ${e.project.niche || "-"}\nCreator language: ${e.project.language}\nAngle: ${x.angle || "-"}\n\nAnalysis of a post that performed (${x.platform}, ${fmt(x.views)} views):\nwhyItWorked: ${x.whyItWorked}\nhook: ${x.hook}\nstructure: ${x.structure.join(" | ")}\nkeyPoints: ${x.keyPoints.join(" | ")}\n${x.source === "caption" ? `caption: ${short(x.sourceText, 800)}` : ""}`,
        { maxTokens: 3000 },
      );
      return shapeScript(r, x);
    }),
  );
  const out: ScriptCard[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") out.push(r.value);
    else e.notes.push(`سناریوی ${extracts[i].url} نوشته نشد: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
  });
  if (!out.length) throw new Error("writer produced no script");
  return out;
}

export function shapeScript(r: Partial<ScriptCard>, x: ExtractCard | ScriptCard): ScriptCard {
  const sourceUrl = "sourceUrl" in x ? x.sourceUrl : x.url;
  const sourcePlatform = "sourcePlatform" in x ? x.sourcePlatform : x.platform;
  const sourcePostIds = "sourcePostIds" in x ? x.sourcePostIds : [x.id];
  const body = Array.isArray(r.body)
    ? r.body.map((b) => ({ time: String((b as ScriptBeatLike)?.time ?? ""), voice: String((b as ScriptBeatLike)?.voice ?? ""), visual: String((b as ScriptBeatLike)?.visual ?? "") }))
    : [];
  const card: ScriptCard = {
    kind: "script",
    scriptId: "scriptId" in x ? x.scriptId : undefined,
    sourcePostIds, sourceUrl, sourcePlatform,
    title: String(r.title ?? ""), hook: String(r.hook ?? ""), body, cta: String(r.cta ?? ""),
    onScreenText: arr(r.onScreenText), captions: arr(r.captions), hashtags: arr(r.hashtags).map((h) => h.replace(/^#/, "")), notes: String(r.notes ?? ""), wordCount: 0,
  };
  card.wordCount = scriptWordCount(card);
  return card;
}
type ScriptBeatLike = { time?: unknown; voice?: unknown; visual?: unknown };

// ----------------------------------------------------------------- 7. Editor
export async function runEditor(e: StepEnv, drafts: ScriptCard[]): Promise<ScriptCard[]> {
  return Promise.all(
    drafts.map(async (d) => {
      try {
        const { kind: _k, scriptId: _s, sourcePostIds: _p, sourceUrl: _u, sourcePlatform: _pl, wordCount: _w, ...payload } = d;
        void _k; void _s; void _p; void _u; void _pl; void _w;
        const r = await e.ctx.callJson<Partial<ScriptCard>>("editor", `Topic: ${e.topic.title}\nCreator language: ${e.project.language}\n\nScript:\n${JSON.stringify(payload)}`, { maxTokens: 3000 });
        const polished = shapeScript(r, d);
        if (!polished.hook || polished.body.length < 3) throw new Error("editor returned an incomplete script");
        return polished;
      } catch (err) {
        e.notes.push(`ویرایش «${d.title}» نشد، نسخه‌ی نویسنده نگه داشته شد: ${err instanceof Error ? err.message : err}`);
        return d;
      }
    }),
  );
}

/** Deliver the final scripts as Script rows (replacing this run's earlier delivery). */
export async function deliverScripts(topicId: string, runId: string, finals: ScriptCard[]): Promise<ScriptCard[]> {
  await db.script.deleteMany({ where: { runId } });
  const out: ScriptCard[] = [];
  for (const s of finals) {
    const row = await db.script.create({ data: { topicId, runId, sourcePostIds: s.sourcePostIds, title: s.title, hook: s.hook, body: s.body, cta: s.cta, onScreenText: s.onScreenText, captions: s.captions, hashtags: s.hashtags, notes: s.notes, status: "draft" } });
    out.push({ ...s, scriptId: row.id });
  }
  return out;
}
