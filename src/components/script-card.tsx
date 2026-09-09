"use client";
import { useState } from "react";
import { PLATFORM_FA } from "@/lib/client";
import type { ScriptCard as ScriptCardT } from "@/lib/pipeline/types";

export function scriptToText(s: ScriptCardT) {
  return [
    `# ${s.title}`, "", `هوک (۰-۳ ثانیه): ${s.hook}`, "",
    ...s.body.map((b) => `[${b.time}] ${b.voice}\n    تصویر: ${b.visual}`), "",
    `CTA: ${s.cta}`, "", `متن روی صفحه: ${s.onScreenText.join(" | ")}`, "",
    `کپشن‌ها:\n${s.captions.map((c) => `- ${c}`).join("\n")}`, "",
    `هشتگ‌ها: ${s.hashtags.map((h) => `#${h}`).join(" ")}`, s.notes ? `\nیادداشت: ${s.notes}` : "",
  ].join("\n");
}

export function ScriptCard({ s, editable, onSave }: { s: ScriptCardT; editable?: boolean; onSave?: (patch: Partial<ScriptCardT>) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<ScriptCardT>(s);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const wc = draft.hook.split(/\s+/).filter(Boolean).length + draft.body.reduce((n, b) => n + b.voice.split(/\s+/).filter(Boolean).length, 0) + draft.cta.split(/\s+/).filter(Boolean).length;

  const copy = async () => { await navigator.clipboard.writeText(scriptToText(s)); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const save = async () => {
    if (!onSave) return;
    setBusy(true);
    try { await onSave({ title: draft.title, hook: draft.hook, body: draft.body, cta: draft.cta, onScreenText: draft.onScreenText, captions: draft.captions, hashtags: draft.hashtags, notes: draft.notes }); setEdit(false); } finally { setBusy(false); }
  };
  const setBeat = (i: number, k: "time" | "voice" | "visual", v: string) => setDraft({ ...draft, body: draft.body.map((b, j) => (j === i ? { ...b, [k]: v } : b)) });

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        {edit ? <input className="input font-bold" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /> : <h3 className="text-lg font-bold" dir="auto">{s.title}</h3>}
        <div className="flex items-center gap-2 text-xs">
          <span className={`chip ${wc < 120 || wc > 175 ? "bg-amber-100 text-amber-800" : ""}`}>{wc} کلمه</span>
          {s.sourceUrl && <a className="chip hover:bg-zinc-200" href={s.sourceUrl} target="_blank" rel="noreferrer">منبع: {PLATFORM_FA[s.sourcePlatform] ?? s.sourcePlatform}</a>}
          <button className="btn" type="button" onClick={copy}>{copied ? "کپی شد" : "کپی متن"}</button>
          {editable && !edit && <button className="btn" type="button" onClick={() => { setDraft(s); setEdit(true); }}>ویرایش</button>}
          {edit && <><button className="btn btn-primary" type="button" disabled={busy} onClick={save}>ذخیره</button><button className="btn" type="button" onClick={() => setEdit(false)}>انصراف</button></>}
        </div>
      </div>
      <div>
        <div className="label">هوک · ۰-۳ ثانیه</div>
        {edit ? <textarea className="input" rows={2} value={draft.hook} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} /> : <p className="font-semibold" dir="auto">{s.hook}</p>}
      </div>
      <div className="space-y-2">
        {(edit ? draft : s).body.map((b, i) => (
          <div key={i} className="grid gap-2 rounded-lg bg-zinc-50 p-2 md:grid-cols-[70px_1fr_1fr]">
            {edit ? <input className="input font-mono text-xs" value={b.time} onChange={(e) => setBeat(i, "time", e.target.value)} /> : <div className="font-mono text-xs text-zinc-500">{b.time}</div>}
            {edit ? <textarea className="input" rows={2} value={b.voice} onChange={(e) => setBeat(i, "voice", e.target.value)} /> : <div className="text-sm" dir="auto">{b.voice}</div>}
            {edit ? <textarea className="input text-xs" rows={2} value={b.visual} onChange={(e) => setBeat(i, "visual", e.target.value)} /> : <div className="text-xs text-zinc-500" dir="auto">🎬 {b.visual}</div>}
          </div>
        ))}
      </div>
      <div>
        <div className="label">CTA</div>
        {edit ? <input className="input" value={draft.cta} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} /> : <p className="text-sm" dir="auto">{s.cta}</p>}
      </div>
      <div className="grid gap-3 md:grid-cols-3 text-xs">
        <div><div className="label">متن روی صفحه</div>{edit ? <textarea className="input" rows={4} value={draft.onScreenText.join("\n")} onChange={(e) => setDraft({ ...draft, onScreenText: e.target.value.split("\n") })} /> : <ul className="list-disc pr-4">{s.onScreenText.map((t, i) => <li key={i} dir="auto">{t}</li>)}</ul>}</div>
        <div><div className="label">کپشن‌های پیشنهادی</div>{edit ? <textarea className="input" rows={4} value={draft.captions.join("\n")} onChange={(e) => setDraft({ ...draft, captions: e.target.value.split("\n") })} /> : <ul className="list-disc pr-4">{s.captions.map((t, i) => <li key={i} dir="auto">{t}</li>)}</ul>}</div>
        <div><div className="label">هشتگ‌ها</div>{edit ? <textarea className="input" rows={4} value={draft.hashtags.join(" ")} onChange={(e) => setDraft({ ...draft, hashtags: e.target.value.split(/\s+/).filter(Boolean).map((h) => h.replace(/^#/, "")) })} /> : <div className="flex flex-wrap gap-1">{s.hashtags.map((h, i) => <span key={i} className="chip">#{h}</span>)}</div>}</div>
      </div>
      {(s.notes || edit) && <div><div className="label">یادداشت برای ادیتور</div>{edit ? <input className="input" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /> : <p className="text-xs text-zinc-500" dir="auto">{s.notes}</p>}</div>}
    </div>
  );
}
