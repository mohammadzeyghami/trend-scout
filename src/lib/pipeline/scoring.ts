/** Numeric part of the Ranker: view velocity + engagement, normalised inside the batch. */
export type Scorable = { views: number; likes: number; comments: number; shares: number; publishedAt: string | Date | null };

export function viewsPerDay(p: Scorable, now = Date.now()) {
  const published = p.publishedAt ? new Date(p.publishedAt).getTime() : now - 30 * 86_400_000;
  const ageDays = Math.max(1, (now - published) / 86_400_000);
  return p.views / ageDays;
}

export function engagementRate(p: Scorable) {
  return (p.likes + p.comments + p.shares) / Math.max(1, p.views);
}

/** 0–100: 55% velocity (log-normalised in the batch), 15% engagement, 30% model relevance (0–10). */
export function finalScore(vpd: number, vpdMaxLog: number, engagement: number, relevance: number) {
  const velocity = vpdMaxLog > 0 ? Math.log10(1 + vpd) / vpdMaxLog : 0;
  const eng = Math.min(1, engagement * 10);
  const rel = Math.max(0, Math.min(10, relevance)) / 10;
  return Math.round((0.55 * velocity + 0.15 * eng + 0.3 * rel) * 100);
}
