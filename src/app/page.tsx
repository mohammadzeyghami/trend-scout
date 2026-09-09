"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtDate, PLATFORM_FA } from "@/lib/client";
import { Empty, ErrorBox, Field } from "@/components/ui";

type Project = { id: string; name: string; niche: string; platforms: string[]; defaultWindowDays: number; autoSelect: boolean; maxSelected: number; createdAt: string; topicCount: number };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", niche: "", platforms: ["youtube", "instagram", "tiktok"], defaultWindowDays: 30, autoSelect: false, maxSelected: 3 });
  const [busy, setBusy] = useState(false);

  const load = () => api<Project[]>("/api/projects").then(setProjects).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/api/projects", { method: "POST", body: form });
      setForm({ ...form, name: "", niche: "" });
      await load();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  const togglePlatform = (p: string) => setForm((f) => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] }));

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <section className="space-y-3">
        <h1 className="text-xl font-bold">پروژه‌ها</h1>
        <ErrorBox error={error} />
        {projects === null ? <p className="text-sm text-zinc-500">در حال بارگذاری…</p> : projects.length === 0 ? (
          <Empty>هنوز پروژه‌ای نداری. از فرم کنار، اولین پروژه (کانال یا پیج) را بساز.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="card block hover:border-violet-300">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold">{p.name}</h2>
                  <span className="chip">{p.topicCount} موضوع</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{p.niche || "بدون نیچ"}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.platforms.map((x) => <span key={x} className="chip">{PLATFORM_FA[x]}</span>)}
                  <span className="chip">{p.defaultWindowDays} روز</span>
                  <span className="chip">{p.autoSelect ? `انتخاب خودکار ${p.maxSelected}` : "انتخاب دستی"}</span>
                </div>
                <div className="mt-2 text-[11px] text-zinc-400">{fmtDate(p.createdAt)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <form onSubmit={create} className="card h-fit space-y-3">
        <h2 className="font-bold">پروژه‌ی جدید</h2>
        <Field label="نام (کانال / پیج)"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="نیچ / حوزه‌ی محتوا" hint="به ایجنت‌ها می‌گوید برای چه مخاطبی می‌سازی"><textarea className="input" rows={2} value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} /></Field>
        <div>
          <span className="label">پلتفرم‌ها</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PLATFORM_FA).map(([k, v]) => (
              <label key={k} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.platforms.includes(k)} onChange={() => togglePlatform(k)} />{v}</label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="بازه‌ی پیش‌فرض (روز)"><input className="input" type="number" min={1} max={365} value={form.defaultWindowDays} onChange={(e) => setForm({ ...form, defaultWindowDays: +e.target.value })} /></Field>
          <Field label="تعداد انتخاب خودکار"><input className="input" type="number" min={1} max={8} value={form.maxSelected} onChange={(e) => setForm({ ...form, maxSelected: +e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autoSelect} onChange={(e) => setForm({ ...form, autoSelect: e.target.checked })} />انتخاب خودکار (بدون توقف برای کاربر)</label>
        <button className="btn btn-primary w-full justify-center" disabled={busy || !form.name || form.platforms.length === 0}>ساختن</button>
      </form>
    </div>
  );
}
