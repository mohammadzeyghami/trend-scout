"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate, fmtDateTime, PLATFORM_FA } from "@/lib/client";
import { Empty, ErrorBox, Field, Status } from "@/components/ui";

type Topic = { id: string; title: string; windowFrom: string; windowTo: string; status: string; createdAt: string; scriptCount: number };
type Project = { id: string; name: string; niche: string; language: string; platforms: string[]; defaultWindowDays: number; autoSelect: boolean; maxSelected: number; topics: Topic[] };

export default function ProjectView({ id }: { id: string }) {
  const router = useRouter();
  const [p, setP] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => api<Project>(`/api/projects/${id}`).then((d) => { setP(d); setDays((x) => x ?? d.defaultWindowDays); }).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!p?.topics.some((t) => t.status === "running")) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [p, load]);

  if (error && !p) return <ErrorBox error={error} />;
  if (!p) return <p className="text-sm text-zinc-500">در حال بارگذاری…</p>;

  const patch = async (data: Partial<Project>) => {
    setError(null); setSaved(false);
    try { setP(await api<Project>(`/api/projects/${id}`, { method: "PATCH", body: data }).then((d) => ({ ...p, ...d, topics: p.topics }))); setSaved(true); } catch (e) { setError((e as Error).message); }
  };

  const createTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const t = await api<{ id: string }>(`/api/projects/${id}/topics`, { method: "POST", body: { title, windowDays: days ?? p.defaultWindowDays } });
      router.push(`/topics/${t.id}`);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(`پروژه‌ی «${p.name}» با همه‌ی موضوع‌ها و سناریوهایش حذف شود؟`)) return;
    await api(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-zinc-500"><Link href="/">پروژه‌ها</Link> / </div>
          <h1 className="text-xl font-bold">{p.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/settings?projectId=${id}`} className="btn">تنظیمات ایجنت‌های این پروژه</Link>
          <button className="btn btn-danger" onClick={remove}>حذف</button>
        </div>
      </div>
      <ErrorBox error={error} />

      <div className="grid gap-6 md:grid-cols-[1fr_340px]">
        <section className="space-y-3">
          <form onSubmit={createTopic} className="card flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1"><Field label="عنوان / موضوع جدید"><input className="input" required minLength={2} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: استفاده از ChatGPT برای نوشتن رزومه" /></Field></div>
            <div className="w-28"><Field label="بازه (روز)"><input className="input" type="number" min={1} max={365} value={days ?? p.defaultWindowDays} onChange={(e) => setDays(+e.target.value)} /></Field></div>
            <button className="btn btn-primary" disabled={busy || title.trim().length < 2}>{busy ? "…" : "شروع جستجو"}</button>
          </form>

          <h2 className="font-bold">موضوع‌ها</h2>
          {p.topics.length === 0 ? <Empty>هنوز موضوعی ندارد. یک عنوان بده تا ایجنت‌ها بروند دنبال پست‌های ترند.</Empty> : (
            <div className="space-y-2">
              {p.topics.map((t) => (
                <Link key={t.id} href={`/topics/${t.id}`} className="card flex items-center justify-between gap-3 hover:border-violet-300">
                  <div>
                    <div className="font-semibold">{t.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">{fmtDate(t.windowFrom)} تا {fmtDate(t.windowTo)} · ساخته‌شده {fmtDateTime(t.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.scriptCount > 0 && <span className="chip">{t.scriptCount} سناریو</span>}
                    <Status value={t.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="card h-fit space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-bold">تنظیمات پروژه</h2>{saved && <span className="text-xs text-green-700">ذخیره شد</span>}</div>
          <Field label="نام"><input className="input" defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && patch({ name: e.target.value })} /></Field>
          <Field label="نیچ"><textarea className="input" rows={3} defaultValue={p.niche} onBlur={(e) => e.target.value !== p.niche && patch({ niche: e.target.value })} /></Field>
          <Field label="زبان خروجی" hint="کد زبان: fa, en, …"><input className="input" defaultValue={p.language} onBlur={(e) => e.target.value !== p.language && patch({ language: e.target.value })} /></Field>
          <div>
            <span className="label">پلتفرم‌ها</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PLATFORM_FA).map(([k, v]) => (
                <label key={k} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={p.platforms.includes(k)} onChange={() => { const next = p.platforms.includes(k) ? p.platforms.filter((x) => x !== k) : [...p.platforms, k]; if (next.length) patch({ platforms: next }); }} />{v}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="بازه‌ی پیش‌فرض"><input className="input" type="number" min={1} max={365} defaultValue={p.defaultWindowDays} onBlur={(e) => +e.target.value !== p.defaultWindowDays && patch({ defaultWindowDays: +e.target.value })} /></Field>
            <Field label="تعداد انتخاب"><input className="input" type="number" min={1} max={8} defaultValue={p.maxSelected} onBlur={(e) => +e.target.value !== p.maxSelected && patch({ maxSelected: +e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.autoSelect} onChange={(e) => patch({ autoSelect: e.target.checked })} />انتخاب خودکار (بدون توقف)</label>
        </aside>
      </div>
    </div>
  );
}
