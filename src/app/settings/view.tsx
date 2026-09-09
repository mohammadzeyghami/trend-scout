"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, PLATFORM_FA } from "@/lib/client";
import { ErrorBox, Field } from "@/components/ui";

type Setting = { agentKey: string; label: string; fa: string; model: string; prompt: string; temperature: number; source: "default" | "global" | "project" };
type Providers = { providers: { platform: string; configured: string; adapter: string; ready: boolean; reason: string | null }[]; openrouter: { configured: boolean; defaultModel: string }; maxPostsPerPlatform: number };
type Project = { id: string; name: string };

export default function SettingsView() {
  const projectId = useSearchParams().get("projectId");
  const [items, setItems] = useState<Setting[]>([]);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [prov, setProv] = useState<Providers | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const load = useCallback(() => api<Setting[]>(`/api/agent-settings${projectId ? `?projectId=${projectId}` : ""}`).then(setItems).catch((e) => setError(e.message)), [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api<Providers>("/api/providers").then(setProv).catch(() => {});
    api<{ id: string; name: string }[]>("/api/models").then(setModels).catch(() => {});
    if (projectId) api<Project>(`/api/projects/${projectId}`).then(setProject).catch(() => {});
  }, [projectId]);

  const save = async (s: Setting, patch: Partial<Setting>) => {
    setError(null);
    try {
      await api("/api/agent-settings", { method: "PUT", body: { agentKey: s.agentKey, projectId: projectId ?? null, ...patch } });
      setSavedKey(s.agentKey); setTimeout(() => setSavedKey(null), 1500);
      await load();
    } catch (e) { setError((e as Error).message); }
  };
  const reset = async (s: Setting) => {
    if (!confirm(projectId ? "نسخه‌ی این پروژه حذف شود و به تنظیم سراسری برگردد؟" : "به پرامپت و مدل پیش‌فرض کد برگردد؟")) return;
    await api(`/api/agent-settings?agentKey=${s.agentKey}${projectId ? `&projectId=${projectId}` : ""}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">تنظیمات ایجنت‌ها {project && <span className="text-base font-normal text-zinc-500">· پروژه‌ی {project.name}</span>}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {projectId ? <>این‌جا نسخه‌ی مخصوص این پروژه را می‌سازی؛ تا وقتی چیزی را عوض نکنی، از تنظیم سراسری استفاده می‌شود. <Link className="underline" href="/settings">تنظیم سراسری</Link></> : "پرامپت، مدل و دمای هر ایجنت زنجیره. هر پروژه می‌تواند نسخه‌ی خودش را داشته باشد."}
        </p>
      </div>
      <ErrorBox error={error} />

      {prov && (
        <div className="card text-sm">
          <div className="mb-2 font-semibold">منابع داده</div>
          <div className="flex flex-wrap gap-2">
            {prov.providers.map((p) => (
              <span key={p.platform} className={`chip ${p.ready ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`} title={p.reason ?? ""}>{PLATFORM_FA[p.platform]}: {p.adapter}{p.reason ? ` (${p.reason})` : ""}</span>
            ))}
            <span className={`chip ${prov.openrouter.configured ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>OpenRouter: {prov.openrouter.configured ? prov.openrouter.defaultModel : "کلید ندارد"}</span>
            <span className="chip">حداکثر {prov.maxPostsPerPlatform} پست از هر پلتفرم</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">انتخاب آداپتور و کلیدها در فایل <code>.env</code> است (PROVIDER_YOUTUBE / PROVIDER_INSTAGRAM / PROVIDER_TIKTOK). «mock» داده‌ی ساختگی می‌دهد تا زنجیره بدون کلید هم اجرا شود.</p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((s) => (
          <details key={s.agentKey} className="card" open={s.source === "project"}>
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="font-semibold">{s.label} · {s.fa}</span>
              <span className="chip font-mono">{s.model}</span>
              <span className="chip">t={s.temperature}</span>
              <span className={`chip ${s.source === "project" ? "bg-violet-100 text-violet-800" : ""}`}>{s.source === "project" ? "مخصوص پروژه" : s.source === "global" ? "سراسری" : "پیش‌فرض کد"}</span>
              {savedKey === s.agentKey && <span className="text-xs text-green-700">ذخیره شد</span>}
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px]">
              <Field label="مدل (OpenRouter)">
                <input className="input font-mono" list="models" defaultValue={s.model} onBlur={(e) => e.target.value && e.target.value !== s.model && save(s, { model: e.target.value })} />
              </Field>
              <Field label="دما"><input className="input" type="number" step={0.1} min={0} max={2} defaultValue={s.temperature} onBlur={(e) => +e.target.value !== s.temperature && save(s, { temperature: +e.target.value })} /></Field>
            </div>
            <Field label="پرامپت سیستم"><textarea className="input font-mono text-xs" rows={10} dir="ltr" defaultValue={s.prompt} onBlur={(e) => e.target.value !== s.prompt && save(s, { prompt: e.target.value })} /></Field>
            <div className="mt-2 flex justify-end">{(s.source !== "default" && (!projectId || s.source === "project")) && <button className="btn btn-danger" onClick={() => reset(s)}>{projectId ? "حذف نسخه‌ی پروژه" : "بازگشت به پیش‌فرض"}</button>}</div>
          </details>
        ))}
      </div>
      <datalist id="models">{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</datalist>
    </div>
  );
}
