"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PIPELINE_STEPS, type StepKey } from "@/lib/agents/constants";
import { api, fmtDateTime, fmtNum, fromDateInput, toDateInput } from "@/lib/client";
import type { ExtractCard, PlanCard, PostCard as PostCardT, ScriptCard as ScriptCardT, StepRecord, Steps, TraceEntry } from "@/lib/pipeline/types";
import { Empty, ErrorBox, Status } from "@/components/ui";
import { PostCard } from "@/components/post-card";
import { ScriptCard, scriptToText } from "@/components/script-card";

type RunSummary = { id: string; status: string; currentStep: string | null; startedAt: string; finishedAt: string | null; error: string | null };
type Run = RunSummary & { steps: Steps; trace: TraceEntry[]; selectedIds: string[] };
type Script = { id: string; title: string; hook: string; body: { time: string; voice: string; visual: string }[]; cta: string; onScreenText: string[]; captions: string[]; hashtags: string[]; notes: string; status: string; sourcePostIds: string[]; runId: string; createdAt: string };
type Topic = { id: string; title: string; windowFrom: string; windowTo: string; status: string; project: { id: string; name: string; autoSelect: boolean; maxSelected: number }; runs: RunSummary[]; latestRun: Run | null; scripts: Script[] };

type Tab = StepKey | "scripts" | "trace";

export default function TopicView({ id }: { id: string }) {
  const [t, setT] = useState<Topic | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [manualTab, setTab] = useState<Tab>("planner");
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [win, setWin] = useState<{ from: string; to: string } | null>(null);
  const [refresh, setRefresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoTab, setAutoTab] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api<Topic>(`/api/topics/${id}`);
      setT(d);
      setWin((w) => w ?? { from: toDateInput(d.windowFrom), to: toDateInput(d.windowTo) });
      const wanted = runId ?? d.latestRun?.id ?? null;
      if (wanted && wanted !== d.latestRun?.id) setRun(await api<Run>(`/api/runs/${wanted}`));
      else setRun(d.latestRun);
      setError(null);
    } catch (e) { setError((e as Error).message); }
  }, [id, runId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);
  useEffect(() => {
    if (run?.status !== "running") return;
    const h = setInterval(load, 2500);
    return () => clearInterval(h);
  }, [run?.status, load]);

  // follow the chain while it runs; sit on the selector when it waits; on the scripts when done
  const followTab: Tab | null = !run ? null : run.status === "running" && run.currentStep ? (run.currentStep as StepKey) : run.status === "waiting_selection" ? "selector" : run.status === "finished" ? "scripts" : null;
  const tab: Tab = autoTab && followTab ? followTab : manualTab;

  const steps = useMemo<Steps>(() => run?.steps ?? {}, [run]);
  const ranked = (steps.ranker?.output ?? []) as PostCardT[];
  const waiting = run?.status === "waiting_selection" && run.id === t?.latestRun?.id;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); setRunId(null); setAutoTab(true); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const select = (auto: boolean) => act(() => api(`/api/topics/${id}/select`, { method: "POST", body: auto ? { auto: true } : { postIds: [...picked] } }));
  const rerun = (fromStep: StepKey) => run && act(() => api(`/api/runs/${run.id}/rerun`, { method: "POST", body: { fromStep, refresh } }));
  const applyWindow = () => win && act(() => api(`/api/topics/${id}/window`, { method: "PATCH", body: { windowFrom: fromDateInput(win.from), windowTo: fromDateInput(win.to, true), refresh } }));
  const freshRun = () => act(() => api(`/api/topics/${id}/run`, { method: "POST", body: { refresh } }));
  const saveCard = (key: StepKey, index: number) => async (patch: Partial<ScriptCardT>) => {
    if (!run) return;
    await api(`/api/runs/${run.id}/steps/${key}/cards`, { method: "PATCH", body: { index, patch } });
    await load();
  };
  const saveScript = async (s: Script, patch: Partial<Script>) => { await api(`/api/scripts/${s.id}`, { method: "PATCH", body: patch }); await load(); };

  const tabs = useMemo<{ key: Tab; fa: string; status?: string; count?: number }[]>(() => [
    ...PIPELINE_STEPS.map((s) => ({ key: s.key as Tab, fa: s.fa, status: steps[s.key]?.status, count: steps[s.key]?.output.length })),
    { key: "scripts", fa: "سناریوها", count: t?.scripts.length },
    { key: "trace", fa: "ترِیس", count: run?.trace.length },
  ], [steps, t, run]);

  if (error && !t) return <ErrorBox error={error} />;
  if (!t) return <p className="text-sm text-zinc-500">در حال بارگذاری…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-zinc-500"><Link href="/">پروژه‌ها</Link> / <Link href={`/projects/${t.project.id}`}>{t.project.name}</Link> /</div>
          <h1 className="text-xl font-bold" dir="auto">{t.title}</h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
            <Status value={run?.status ?? t.status} />
            {run?.status === "running" && <span>در حال اجرای «{PIPELINE_STEPS.find((s) => s.key === run.currentStep)?.fa}»…</span>}
            {run?.error && <span className="text-red-600">{run.error}</span>}
          </div>
        </div>
        <div className="card flex flex-wrap items-end gap-2 py-2">
          <label className="text-xs">از<input type="date" className="input mt-1" value={win?.from ?? ""} onChange={(e) => setWin({ ...win!, from: e.target.value })} /></label>
          <label className="text-xs">تا<input type="date" className="input mt-1" value={win?.to ?? ""} onChange={(e) => setWin({ ...win!, to: e.target.value })} /></label>
          <label className="flex items-center gap-1 pb-2 text-xs"><input type="checkbox" checked={refresh} onChange={(e) => setRefresh(e.target.checked)} />دوباره از پلتفرم بگیر</label>
          <button className="btn" disabled={busy || run?.status === "running"} onClick={applyWindow} title="بازه را ذخیره می‌کند و از مرحله‌ی جمع‌آوری دوباره اجرا می‌کند">اعمال بازه و اجرا از جمع‌آوری</button>
          <button className="btn btn-primary" disabled={busy || run?.status === "running"} onClick={freshRun}>اجرای تازه</button>
        </div>
      </div>
      <ErrorBox error={error} />

      {t.runs.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500">اجراها:</span>
          {t.runs.map((r, i) => (
            <button key={r.id} onClick={() => { setRunId(r.id); setAutoTab(false); }} className={`chip hover:bg-zinc-200 ${run?.id === r.id ? "ring-2 ring-violet-300" : ""}`}>
              #{t.runs.length - i} · {fmtDateTime(r.startedAt)} · <Status value={r.status} />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-zinc-200">
        {tabs.map((x) => (
          <button key={x.key} onClick={() => { setTab(x.key); setAutoTab(false); }} className={`-mb-px flex items-center gap-1 border-b-2 px-3 py-2 text-sm ${tab === x.key ? "border-violet-600 font-semibold" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>
            <span className={`h-2 w-2 rounded-full ${dot(x.status)}`} />
            {x.fa}
            {x.count != null && <span className="text-[10px] text-zinc-400">({fmtNum(x.count)})</span>}
          </button>
        ))}
      </div>

      {!run ? <Empty>هنوز اجرایی ندارد.</Empty> : tab === "scripts" ? (
        <div className="space-y-3">
          {t.scripts.length === 0 ? <Empty>هنوز سناریویی تحویل نشده. وقتی ویراستار تمام کند این‌جا ظاهر می‌شود.</Empty> : t.scripts.map((s) => (
            <div key={s.id} className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Status value={s.status} /><span>{fmtDateTime(s.createdAt)}</span>
                <button className="btn" onClick={() => saveScript(s, { status: s.status === "final" ? "draft" : "final" })}>{s.status === "final" ? "برگردان به پیش‌نویس" : "علامت نهایی"}</button>
                <button className="btn" onClick={() => navigator.clipboard.writeText(scriptToText({ ...s, kind: "script", sourceUrl: "", sourcePlatform: "instagram", wordCount: 0 }))}>کپی</button>
                <button className="btn btn-danger" onClick={async () => { if (confirm("این سناریو حذف شود؟")) { await api(`/api/scripts/${s.id}`, { method: "DELETE" }); await load(); } }}>حذف</button>
              </div>
              <ScriptCard s={{ ...s, kind: "script", sourceUrl: "", sourcePlatform: "instagram", wordCount: 0 }} editable onSave={(patch) => saveScript(s, patch as Partial<Script>)} />
            </div>
          ))}
        </div>
      ) : tab === "trace" ? (
        <TraceTable trace={run.trace} />
      ) : (
        <StepPanel
          stepKey={tab} rec={steps[tab]} run={run} busy={busy} refresh={refresh}
          waiting={!!waiting} ranked={ranked} picked={picked} setPicked={setPicked} maxSelected={t.project.maxSelected}
          onSelect={select} onRerun={rerun} saveCard={saveCard}
        />
      )}
    </div>
  );
}

const dot = (s?: string) => s === "done" ? "bg-green-500" : s === "running" ? "bg-blue-500 animate-pulse" : s === "failed" ? "bg-red-500" : s === "waiting" ? "bg-amber-500" : "bg-zinc-300";

function StepPanel(p: {
  stepKey: StepKey; rec?: StepRecord; run: Run; busy: boolean; refresh: boolean;
  waiting: boolean; ranked: PostCardT[]; picked: Set<string>; setPicked: (s: Set<string>) => void; maxSelected: number;
  onSelect: (auto: boolean) => void; onRerun: (k: StepKey) => void; saveCard: (k: StepKey, i: number) => (patch: Partial<ScriptCardT>) => Promise<void>;
}) {
  const { stepKey, rec } = p;
  const meta = PIPELINE_STEPS.find((s) => s.key === stepKey)!;
  const canRerun = p.run.status !== "running" && !(stepKey === "planner" ? false : !p.run.steps[PIPELINE_STEPS[PIPELINE_STEPS.findIndex((s) => s.key === stepKey) - 1]?.key as StepKey]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{meta.label} · {meta.fa}</span>
          <span className="text-zinc-500">{meta.desc}</span>
          {rec && <Status value={rec.status} />}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {rec?.startedAt && <span>{fmtDateTime(rec.startedAt)}{rec.finishedAt && ` → ${fmtDateTime(rec.finishedAt)}`}</span>}
          <button className="btn" disabled={p.busy || !canRerun} onClick={() => p.onRerun(stepKey)} title="اجرای جدید؛ مراحل قبل همان‌طور که هست کپی می‌شود">اجرای دوباره از این مرحله{stepKey === "collector" && p.refresh ? " (از پلتفرم)" : ""}</button>
        </div>
      </div>
      {rec?.error && <ErrorBox error={`خطای ایجنت (ورودی عیناً عبور داده شد): ${rec.error}`} />}
      {rec?.notes?.length ? <ul className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600">{rec.notes.map((n, i) => <li key={i}>• {n}</li>)}</ul> : null}

      {!rec ? <Empty>این مرحله هنوز اجرا نشده.</Empty>
        : stepKey === "planner" ? <PlanView plan={rec.output[0] as PlanCard | undefined} />
        : stepKey === "collector" || stepKey === "ranker" ? (
          rec.output.length === 0 ? <Empty>{rec.status === "running" ? "در حال کار…" : "پستی نیست."}</Empty> : <div className="grid gap-2 lg:grid-cols-2">{(rec.output as PostCardT[]).map((c) => <PostCard key={c.id} p={c} />)}</div>
        )
        : stepKey === "selector" ? (
          p.waiting ? (
            <div className="space-y-3">
              <div className="card flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50">
                <span className="text-sm">زنجیره منتظر توست: پست‌هایی را که می‌خواهی سناریو از آن‌ها ساخته شود تیک بزن ({p.picked.size} انتخاب‌شده)، یا بگذار ایجنت {p.maxSelected} تا را خودش بردارد.</span>
                <button className="btn btn-primary" disabled={p.busy || p.picked.size === 0} onClick={() => p.onSelect(false)}>ادامه با انتخاب‌های من</button>
                <button className="btn" disabled={p.busy} onClick={() => p.onSelect(true)}>انتخاب خودکار</button>
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {p.ranked.map((c) => <PostCard key={c.id} p={c} selectable checked={p.picked.has(c.id)} onToggle={() => { const n = new Set(p.picked); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); p.setPicked(n); }} />)}
              </div>
            </div>
          ) : rec.output.length === 0 ? <Empty>{rec.status === "waiting" ? "این اجرا منتظر انتخاب بود." : "انتخابی نیست."}</Empty>
          : <div className="grid gap-2 lg:grid-cols-2">{(rec.output as PostCardT[]).map((c) => <PostCard key={c.id} p={c} />)}</div>
        )
        : stepKey === "extractor" ? (
          rec.output.length === 0 ? <Empty>{rec.status === "running" ? "در حال تحلیل…" : "چیزی استخراج نشد."}</Empty> : <div className="space-y-3">{(rec.output as ExtractCard[]).map((x) => <ExtractView key={x.id} x={x} />)}</div>
        )
        : (
          rec.output.length === 0 ? <Empty>{rec.status === "running" ? "در حال نوشتن…" : "سناریویی نیست."}</Empty>
          : <div className="space-y-3">{(rec.output as ScriptCardT[]).map((s, i) => <ScriptCard key={i} s={s} editable={p.run.status !== "running"} onSave={p.saveCard(stepKey, i)} />)}</div>
        )}
    </div>
  );
}

function PlanView({ plan }: { plan?: PlanCard }) {
  if (!plan) return <Empty>در حال برنامه‌ریزی…</Empty>;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="card"><div className="label">کوئری‌های جستجو</div><ul className="space-y-1 text-sm">{plan.queries.map((q, i) => <li key={i} dir="auto">🔍 {q}</li>)}</ul></div>
      <div className="card"><div className="label">هشتگ‌ها</div><div className="flex flex-wrap gap-1">{plan.hashtags.map((h, i) => <span key={i} className="chip">#{h}</span>)}</div></div>
      <div className="card"><div className="label">زاویه‌های محتوایی</div><ul className="space-y-1 text-sm">{plan.angles.map((a, i) => <li key={i} dir="auto">✦ {a}</li>)}</ul></div>
    </div>
  );
}

function ExtractView({ x }: { x: ExtractCard }) {
  return (
    <div className="card space-y-2">
      <PostCard p={{ ...x, kind: "post" }} />
      <div className="flex gap-2 text-xs"><span className="chip">{x.source === "transcript" ? "از ترنسکریپت" : "از کپشن"}</span>{x.angle && <span className="chip">زاویه: {x.angle}</span>}</div>
      {x.whyItWorked ? (
        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <div><div className="label">چرا گرفت</div><p dir="auto">{x.whyItWorked}</p><div className="label mt-2">هوک</div><p dir="auto">{x.hook}</p></div>
          <div><div className="label">ساختار</div><ol className="list-decimal pr-4">{x.structure.map((s, i) => <li key={i} dir="auto">{s}</li>)}</ol><div className="label mt-2">نکته‌های کلیدی</div><ul className="list-disc pr-4">{x.keyPoints.map((s, i) => <li key={i} dir="auto">{s}</li>)}</ul></div>
        </div>
      ) : <p className="text-xs text-zinc-500">تحلیلی ثبت نشد.</p>}
      <details className="text-xs text-zinc-500"><summary className="cursor-pointer">متن منبع</summary><p className="mt-1 whitespace-pre-wrap" dir="auto">{x.sourceText}</p></details>
    </div>
  );
}

function TraceTable({ trace }: { trace: TraceEntry[] }) {
  if (!trace.length) return <Empty>هنوز فراخوانی مدلی ثبت نشده.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="text-right text-zinc-500"><th className="p-2">ایجنت</th><th className="p-2">مدل</th><th className="p-2">زمان</th><th className="p-2">مدت</th><th className="p-2">توکن</th><th className="p-2">وضعیت</th></tr></thead>
        <tbody>
          {trace.map((e, i) => (
            <tr key={i} className="border-t border-zinc-200 align-top">
              <td className="p-2 font-semibold">{PIPELINE_STEPS.find((s) => s.key === e.agent)?.fa ?? e.agent}</td>
              <td className="p-2 font-mono">{e.model}</td>
              <td className="p-2">{fmtDateTime(e.at)}</td>
              <td className="p-2">{(e.ms / 1000).toFixed(1)}s</td>
              <td className="p-2">{e.promptTokens ?? "—"} / {e.completionTokens ?? "—"}</td>
              <td className="p-2">{e.ok ? <span className="text-green-700">ok</span> : <span className="text-red-700" title={e.error}>{e.error?.slice(0, 80)}</span>}
                <details className="mt-1 text-zinc-500"><summary className="cursor-pointer">جزئیات</summary><pre className="max-w-xl whitespace-pre-wrap" dir="auto">{e.userPreview}{"\n---\n"}{e.answerPreview}</pre></details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
