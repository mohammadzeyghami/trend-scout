"use client";
import { fmtDate, fmtNum, PLATFORM_COLOR, PLATFORM_FA } from "@/lib/client";
import type { PostCard as PostCardT } from "@/lib/pipeline/types";

export function PostCard({ p, selectable, checked, onToggle }: { p: PostCardT; selectable?: boolean; checked?: boolean; onToggle?: () => void }) {
  return (
    <div className={`card flex gap-3 ${checked ? "border-violet-400 bg-violet-50/40" : ""}`}>
      {selectable && <input type="checkbox" className="mt-1" checked={!!checked} onChange={onToggle} />}
      {/* eslint-disable-next-line @next/next/no-img-element -- remote thumbnails from three platforms, no loader */}
      {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="h-20 w-28 flex-none rounded-lg object-cover" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-md px-2 py-0.5 ${PLATFORM_COLOR[p.platform]}`}>{PLATFORM_FA[p.platform]}</span>
          {p.rank != null && <span className="chip">#{p.rank}</span>}
          {p.score != null && <span className="chip font-mono">امتیاز {p.score}</span>}
          {p.relevance != null && <span className="chip">ربط {p.relevance}/۱۰</span>}
          {p.hasTranscript && <span className="chip">ترنسکریپت</span>}
          <span className="text-zinc-400">{p.author && `@${p.author} · `}{fmtDate(p.publishedAt)}</span>
        </div>
        <a href={p.url} target="_blank" rel="noreferrer" className="mt-1 block font-semibold hover:text-violet-700" dir="auto">{p.title || p.caption.slice(0, 80) || p.url}</a>
        {p.caption && p.title && <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600" dir="auto">{p.caption}</p>}
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-600">
          <span>👁 {fmtNum(p.views)}</span>
          {p.viewsPerDay != null && <span>⚡ {fmtNum(p.viewsPerDay)} / روز</span>}
          <span>♥ {fmtNum(p.likes)}</span>
          <span>💬 {fmtNum(p.comments)}</span>
          {p.shares > 0 && <span>↗ {fmtNum(p.shares)}</span>}
          {p.durationSec != null && <span>⏱ {p.durationSec}s</span>}
        </div>
        {(p.relevanceReason || p.selectReason) && <div className="mt-1 text-xs text-violet-700">{p.selectReason ?? p.relevanceReason}</div>}
      </div>
    </div>
  );
}
