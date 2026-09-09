"use client";
import { STATUS_COLOR, STATUS_FA } from "@/lib/client";

export function Status({ value }: { value: string }) {
  return <span className={`rounded-md px-2 py-0.5 text-xs ${STATUS_COLOR[value] ?? "bg-zinc-100"}`}>{STATUS_FA[value] ?? value}</span>;
}

export function ErrorBox({ error }: { error: string | null }) {
  return error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-zinc-400">{hint}</span>}
    </label>
  );
}
